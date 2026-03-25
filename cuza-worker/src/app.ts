// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Daniel C. (DynoW) — https://github.com/DynoW/cuza.pages.dev

import { Hono, type Context } from "hono";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Bindings = {
  FILES: R2Bucket;
  UPLOAD_PASSWORD: string;
  DEPLOY_HOOK_URL: string;
  RATE_LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> };
  AUTH_FAIL_LIMITER: {
    limit(opts: { key: string }): Promise<{ success: boolean }>;
  };
};

/**
 * Recursive file structure stored in R2 as index.json.
 * Leaves are string URLs (R2 keys), branches are nested objects.
 */
interface FileStructure {
  [key: string]: FileStructure | string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const INDEX_KEY = "index.json";
const RECENT_CHANGES_KEY = "recent-changes.json";
const MAX_RECENT_CHANGES = 100;

interface RecentChange {
  key: string;
  filename: string;
  uploadedAt: string;
  source: "form" | "scraper";
  page?: string;
  year?: string;
}

interface CleanupStats {
  checkedLeaves: number;
  keptLeaves: number;
  removedLeaves: number;
  removedBranches: number;
  listedObjects: number;
  listCalls: number;
}

async function getIndex(bucket: R2Bucket): Promise<FileStructure> {
  const obj = await bucket.get(INDEX_KEY);
  if (!obj) return {};
  return obj.json<FileStructure>();
}

async function putIndex(bucket: R2Bucket, index: FileStructure): Promise<void> {
  await bucket.put(INDEX_KEY, JSON.stringify(index, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function getRecentChanges(bucket: R2Bucket): Promise<RecentChange[]> {
  const obj = await bucket.get(RECENT_CHANGES_KEY);
  if (!obj) return [];

  try {
    const parsed = await obj.json<unknown>();
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RecentChange => {
      if (!item || typeof item !== "object") return false;
      const entry = item as Partial<RecentChange>;
      return (
        typeof entry.key === "string" &&
        typeof entry.filename === "string" &&
        typeof entry.uploadedAt === "string" &&
        (entry.source === "form" || entry.source === "scraper")
      );
    });
  } catch {
    return [];
  }
}

async function appendRecentChange(
  bucket: R2Bucket,
  change: RecentChange,
): Promise<void> {
  const current = await getRecentChanges(bucket);
  const next = [change, ...current].slice(0, MAX_RECENT_CHANGES);
  await bucket.put(RECENT_CHANGES_KEY, JSON.stringify(next, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

/**
 * Navigate into the index to a specific path like "fizica/pages/bac".
 */
function getSubtree(
  index: FileStructure,
  segments: string[],
): FileStructure | string | null {
  let current: FileStructure | string = index;
  for (const seg of segments) {
    if (typeof current === "string" || current === null) return null;
    if (!(seg in current)) return null;
    current = current[seg];
  }
  return current;
}

/**
 * Set a value at a nested path, creating intermediate objects as needed.
 */
function setInIndex(
  index: FileStructure,
  segments: string[],
  value: string,
): void {
  let current = index;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!(seg in current) || typeof current[seg] === "string") {
      current[seg] = {};
    }
    current = current[seg] as FileStructure;
  }
  current[segments[segments.length - 1]] = value;
}

/**
 * Resolve (subject, page) to the correct index path segments.
 */
function resolvePathSegments(subject: string, page: string): string[] {
  const subjectLower = subject.toLowerCase();
  const pageLower = page.toLowerCase();

  if (subjectLower === "admitere") {
    if (pageLower.includes("/extra")) {
      const subsubject = pageLower.replace("/extra", "");
      return ["admitere", subsubject, "extra"];
    }
    return ["admitere", pageLower, "admitere"];
  }

  if (pageLower === "extra") {
    return [subjectLower, "extra"];
  }

  return [subjectLower, "pages", pageLower];
}

/**
 * Extract year keys from a FileStructure.
 */
function extractYears(structure: FileStructure): number[] {
  const years = new Set<number>();
  const traverse = (obj: FileStructure) => {
    for (const [key, value] of Object.entries(obj)) {
      if (/^20\d{2}$/.test(key)) years.add(parseInt(key, 10));
      if (typeof value === "object" && value !== null)
        traverse(value as FileStructure);
    }
  };
  traverse(structure);
  return [...years].sort((a, b) => b - a);
}

async function triggerDeploy(hookUrl: string | undefined): Promise<void> {
  if (!hookUrl) return;
  await fetch(hookUrl, { method: "POST" });
}

function isValidBearerAuth(authHeader: string, password: string): boolean {
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return false;
  try {
    const [, pwd] = atob(token).split(":");
    return pwd === password;
  } catch {
    return false;
  }
}

function getClientIp(c: Context<{ Bindings: Bindings }>): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

async function enforceUploadAuth(
  c: Context<{ Bindings: Bindings }>,
): Promise<Response | null> {
  const authHeader = c.req.header("Authorization");
  if (authHeader && isValidBearerAuth(authHeader, c.env.UPLOAD_PASSWORD)) {
    return null;
  }

  // Track only failed auth attempts with a dedicated limiter key.
  const ip = getClientIp(c);
  const { success } = await c.env.AUTH_FAIL_LIMITER.limit({
    key: `auth-fail:${ip}`,
  });

  if (!success) {
    return c.text("Prea multe încercări eșuate. Încearcă din nou în 1 minut.", 429);
  }

  return c.text("Neautorizat", 401);
}

async function listAllObjectKeys(
  bucket: R2Bucket,
  stats: CleanupStats,
): Promise<Set<string>> {
  const keys = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const listed = await bucket.list(cursor ? { cursor } : undefined);
    stats.listCalls += 1;
    stats.listedObjects += listed.objects.length;

    for (const object of listed.objects) {
      keys.add(object.key);
    }

    if (!listed.truncated || !listed.cursor) break;
    cursor = listed.cursor;
  }

  return keys;
}

function pruneMissingIndexLeaves(
  node: FileStructure | string,
  existingKeys: Set<string>,
  stats: CleanupStats,
): FileStructure | string | null {
  if (typeof node === "string") {
    stats.checkedLeaves += 1;
    if (existingKeys.has(node)) {
      stats.keptLeaves += 1;
      return node;
    }
    stats.removedLeaves += 1;
    return null;
  }

  const cleaned: FileStructure = {};
  for (const [key, value] of Object.entries(node)) {
    const pruned = pruneMissingIndexLeaves(value, existingKeys, stats);
    if (pruned !== null) {
      cleaned[key] = pruned;
    }
  }

  if (Object.keys(cleaned).length === 0) {
    stats.removedBranches += 1;
    return null;
  }

  return cleaned;
}

const VALID_PAGES = new Set(["bac", "teste", "sim"]);
const VALID_SIMULATIONS = new Set(["judetene", "locale"]);
const YEAR_RE = /^20[1-3]\d$/;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Validate the multipart form data sent to /upload.
 * Returns a Romanian error message, or null on success.
 */
function validateFormData(formData: FormData): string | null {
  const page = formData.get("page") as string | null;
  const year = formData.get("year") as string | null;
  const type = formData.get("type") as string | null;
  const type2 = formData.get("type2") as string | null;
  const file = formData.get("file") as unknown as File | null;

  // ── Required fields ────────────────────────────────────────────────────────
  if (!page || !year || !type || !type2 || !file) {
    return "Câmpuri obligatorii lipsă";
  }

  // ── Field-level validation ─────────────────────────────────────────────────
  if (!VALID_PAGES.has(page)) {
    return "Pagină invalidă";
  }
  if (!YEAR_RE.test(year)) {
    return "An invalid (format așteptat: 20XX)";
  }
  if (file.type !== "application/pdf") {
    return "Fișierul trebuie să fie PDF";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Fișierul depășește limita de 20 MB";
  }

  // ── Page-specific validation ───────────────────────────────────────────────
  if (page === "bac" && !formData.get("title")) {
    return "Lipsă titlu";
  }
  if (page === "teste" && !formData.get("testNumber")) {
    return "Lipsă număr test";
  }
  if (page === "sim") {
    const simulation = formData.get("simulation") as string | null;
    if (!simulation) return "Lipsă tip simulare";
    if (!VALID_SIMULATIONS.has(simulation)) return "Tip de simulare invalid";
    if (simulation === "judetene" && !formData.get("county"))
      return "Lipsă județ pentru simulare județeană";
    if (simulation === "locale" && !formData.get("local"))
      return "Lipsă localitate pentru simulare locală";
  }

  return null;
}

const sanitizePathSegment = (s: string | null | undefined): string =>
  (s ?? "").replace(/[^a-zA-Z0-9_\-ăîșțâĂÎȘȚÂ ]/g, "").trim();

interface UploadPathData {
  page: string;
  year: string;
  title: string | null;
  type: string;
  type2: string;
  testNumber: string | null;
  simulation: string | null;
  county: string | null;
  local: string | null;
}

function generateUploadPath(data: UploadPathData): { r2Key: string } {
  const { page, year, type, type2, testNumber, simulation } = data;
  const title = sanitizePathSegment(data.title);
  const county = sanitizePathSegment(data.county);
  const local = sanitizePathSegment(data.local);

  if (page === "bac") {
    return {
      r2Key: `fizica/pages/bac/${year}/${title}/E_d_fizica_teoretic_vocational_${year}_${type2}_${type}.pdf`,
    };
  }
  if (page === "teste") {
    return {
      r2Key: `fizica/pages/teste-de-antrenament/${year}/E_d_fizica_${year}_${type2}_${testNumber}.pdf`,
    };
  }
  const location = simulation === "judetene" ? county : local;
  return {
    r2Key: `fizica/pages/simulari-judetene/${year}/E_d_fizica_${location}_${year}_${type2}.pdf`,
  };
}

// ── Route registration ─────────────────────────────────────────────────────────

export function registerRoutes(app: Hono<{ Bindings: Bindings }>): void {
  app.get("/ping", (c) => c.text("Pong!", 200));

  /**
   * GET /files?subject=X&page=Y
   * Returns { content, extra, years } in one request.
   */
  app.get("/files", async (c) => {
    const subject = c.req.query("subject");
    const page = c.req.query("page");

    if (!subject || !page)
      return c.json({ error: "Missing subject or page" }, 400);

    const index = await getIndex(c.env.FILES);
    const segments = resolvePathSegments(subject, page);
    const subtree = getSubtree(index, segments);
    const content: FileStructure =
      subtree !== null && typeof subtree !== "string"
        ? (subtree as FileStructure)
        : {};
    const years = extractYears(content);

    // Extra content
    const extraSegments = resolvePathSegments(
      subject,
      subject.toLowerCase() === "admitere" ? `${page}/extra` : "extra",
    );
    const extraSubtree = getSubtree(index, extraSegments);
    const extra: FileStructure =
      extraSubtree !== null && typeof extraSubtree !== "string"
        ? (extraSubtree as FileStructure)
        : {};

    return c.json({ content, extra, years });
  });

  /**
   * GET /file/:key → Serve a file from R2
   */
  app.get("/file/:key{.*}", async (c) => {
    const key = c.req.param("key");
    if (!key) return c.text("Not Found", 404);

    const object = await c.env.FILES.get(key);
    if (!object) return c.text("Not Found", 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(object.body, { headers });
  });

  /**
   * POST /upload — Upload a single PDF to R2 (from the web form).
   */
  app.post("/upload", async (c) => {
    const authError = await enforceUploadAuth(c);
    if (authError) {
      return authError;
    }

    const contentType = c.req.header("Content-Type") || "";
    if (!contentType.includes("multipart/form-data"))
      return c.text("Tip de conținut neacceptat", 415);

    let formData: FormData;
    try {
      formData = await c.req.raw.formData();
    } catch {
      return c.text("Eroare la citirea datelor", 400);
    }

    const validationError = validateFormData(formData);
    if (validationError) return c.text(validationError, 400);

    const page = formData.get("page") as string;
    const year = formData.get("year") as string;
    const title = formData.get("title") as string | null;
    const type = formData.get("type") as string;
    const type2 = formData.get("type2") as string;
    const testNumber = formData.get("testNumber") as string | null;
    const simulation = formData.get("simulation") as string | null;
    const county = formData.get("county") as string | null;
    const local = formData.get("local") as string | null;
    const file = formData.get("file") as unknown as File;

    const { r2Key } = generateUploadPath({
      page,
      year,
      title,
      type,
      type2,
      testNumber,
      simulation,
      county,
      local,
    });

    await c.env.FILES.put(r2Key, file, {
      httpMetadata: { contentType: "application/pdf" },
    });

    const index = await getIndex(c.env.FILES);
    setInIndex(index, r2Key.split("/"), r2Key);
    await putIndex(c.env.FILES, index);

    await appendRecentChange(c.env.FILES, {
      key: r2Key,
      filename: r2Key.split("/").at(-1) ?? r2Key,
      uploadedAt: new Date().toISOString(),
      source: "form",
      page,
      year,
    });

    await triggerDeploy(c.env.DEPLOY_HOOK_URL);
    return c.text(`Fișier încărcat cu succes: ${r2Key.split("/").at(-1)}`, 200);
  });

  /**
   * POST /upload-scraper — Bulk upload from the watchtower/scraper.
   * Accepts multipart with: password, key (R2 path), file (PDF blob).
   */
  app.post("/upload-scraper", async (c) => {
    const contentType = c.req.header("Content-Type") || "";
    if (!contentType.includes("multipart/form-data"))
      return c.text("Unsupported content type", 415);

    let formData: FormData;
    try {
      formData = await c.req.raw.formData();
    } catch {
      return c.text("Failed to parse form data", 400);
    }

    const authError = await enforceUploadAuth(c);
    if (authError) {
      return authError;
    }

    const key = formData.get("key") as string;
    const file = formData.get("file") as unknown as File;

    if (!key || !file) return c.text("Missing key or file", 400);

    // Reject path traversal attempts
    if (key.includes("..") || key.startsWith("/"))
      return c.text("Invalid key", 400);

    await c.env.FILES.put(key, file, {
      httpMetadata: { contentType: "application/pdf" },
    });

    const index = await getIndex(c.env.FILES);
    setInIndex(index, key.split("/"), key);
    await putIndex(c.env.FILES, index);

    await appendRecentChange(c.env.FILES, {
      key,
      filename: key.split("/").at(-1) ?? key,
      uploadedAt: new Date().toISOString(),
      source: "scraper",
    });

    return c.json({ success: true, key });
  });

  /**
   * POST /trigger-deploy — Trigger a Cloudflare Pages deploy hook.
   * Called by the scraper after all files have been uploaded.
   */
  app.post("/trigger-deploy", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !isValidBearerAuth(authHeader, c.env.UPLOAD_PASSWORD)) {
      return c.text("Unauthorized", 401);
    }
    await triggerDeploy(c.env.DEPLOY_HOOK_URL);
    return c.json({ success: true });
  });

  /**
   * POST /cleanup-index?dryRun=true|false
   * Remove stale index leaves that no longer exist as R2 objects.
   */
  app.post("/cleanup-index", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !isValidBearerAuth(authHeader, c.env.UPLOAD_PASSWORD)) {
      return c.text("Unauthorized", 401);
    }

    const dryRun = c.req.query("dryRun") === "true";
    const index = await getIndex(c.env.FILES);
    const stats: CleanupStats = {
      checkedLeaves: 0,
      keptLeaves: 0,
      removedLeaves: 0,
      removedBranches: 0,
      listedObjects: 0,
      listCalls: 0,
    };

    const existingKeys = await listAllObjectKeys(c.env.FILES, stats);
    const pruned = pruneMissingIndexLeaves(index, existingKeys, stats);
    const cleanedIndex =
      pruned && typeof pruned === "object" ? (pruned as FileStructure) : {};

    if (!dryRun) {
      await putIndex(c.env.FILES, cleanedIndex);
    }

    return c.json({
      success: true,
      dryRun,
      stats,
      subjects: Object.keys(cleanedIndex),
    });
  });

  /**
   * GET /recent-changes?limit=20
   * Returns { changes } sorted newest-first.
   */
  app.get("/recent-changes", async (c) => {
    const limitRaw = c.req.query("limit");
    const parsedLimit = Number.parseInt(limitRaw ?? "20", 10);
    const limit = Number.isNaN(parsedLimit)
      ? 20
      : Math.min(Math.max(parsedLimit, 1), MAX_RECENT_CHANGES);

    const changes = await getRecentChanges(c.env.FILES);
    return c.json({ changes: changes.slice(0, limit) });
  });

  /**
   * GET /structure — Return subjects → pages map derived from the index.
   * Used by the SSG build to generate static paths dynamically.
   */
  app.get("/structure", async (c) => {
    const index = await getIndex(c.env.FILES);
    const structure: Record<string, string[]> = {};

    for (const [subject, value] of Object.entries(index)) {
      if (typeof value !== "object" || value === null) continue;
      const branch = value as FileStructure;

      if (subject === "admitere") {
        // admitere's "pages" are its direct children (e.g. fizica, info, mate)
        structure[subject] = Object.keys(branch).filter(
          (k) => typeof branch[k] === "object" && branch[k] !== null,
        );
      } else if ("pages" in branch && typeof branch.pages === "object") {
        structure[subject] = Object.keys(branch.pages as FileStructure);
      }
    }

    return c.json(structure);
  });

  /**
   * GET /index — Return the full index (for debugging / migration).
   */
  app.get("/index", async (c) => {
    const index = await getIndex(c.env.FILES);
    return c.json(index);
  });
}
