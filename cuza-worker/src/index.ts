import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ── Types ──────────────────────────────────────────────────────────────────────

type Bindings = {
  FILES: R2Bucket;
  UPLOAD_PASSWORD: string;
};

/**
 * Recursive file structure stored in R2 as index.json.
 * Leaves are string URLs (R2 keys), branches are nested objects.
 */
interface FileStructure {
  [key: string]: FileStructure | string;
}

// ── App ────────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: (origin) => {
    const allowed = ['https://cuza.pages.dev', 'http://localhost:4321'];
    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const INDEX_KEY = 'index.json';

async function getIndex(bucket: R2Bucket): Promise<FileStructure> {
  const obj = await bucket.get(INDEX_KEY);
  if (!obj) return {};
  return obj.json<FileStructure>();
}

async function putIndex(bucket: R2Bucket, index: FileStructure): Promise<void> {
  await bucket.put(INDEX_KEY, JSON.stringify(index, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

/**
 * Navigate into the index to a specific path like "fizica/pages/bac".
 */
function getSubtree(index: FileStructure, segments: string[]): FileStructure | string | null {
  let current: FileStructure | string = index;
  for (const seg of segments) {
    if (typeof current === 'string' || current === null) return null;
    if (!(seg in current)) return null;
    current = current[seg];
  }
  return current;
}

/**
 * Set a value at a nested path, creating intermediate objects as needed.
 */
function setInIndex(index: FileStructure, segments: string[], value: string): void {
  let current = index;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!(seg in current) || typeof current[seg] === 'string') {
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

  if (subjectLower === 'admitere') {
    if (pageLower.includes('/extra')) {
      const subsubject = pageLower.replace('/extra', '');
      return ['admitere', subsubject, 'extra'];
    }
    return ['admitere', pageLower, 'admitere'];
  }

  if (pageLower === 'extra') {
    return [subjectLower, 'extra'];
  }

  return [subjectLower, 'pages', pageLower];
}

/**
 * Extract year keys from a FileStructure.
 */
function extractYears(structure: FileStructure): number[] {
  const years = new Set<number>();
  const traverse = (obj: FileStructure) => {
    for (const [key, value] of Object.entries(obj)) {
      if (/^20\d{2}$/.test(key)) years.add(parseInt(key, 10));
      if (typeof value === 'object' && value !== null) traverse(value as FileStructure);
    }
  };
  traverse(structure);
  return Array.from(years).sort((a, b) => b - a);
}

function isValidAuth(authHeader: string, password: string): boolean {
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return false;
  try {
    const decoded = atob(parts[1]);
    const [, pwd] = decoded.split(':');
    return pwd === password;
  } catch {
    return false;
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/ping', (c) => c.text('Pong!', 200));

/**
 * GET /files?subject=X&page=Y        → { content: FileStructure }
 * GET /files?subject=X&page=Y&years=true → { years: number[] }
 */
app.get('/files', async (c) => {
  const subject = c.req.query('subject');
  const page = c.req.query('page');
  const yearsOnly = c.req.query('years') === 'true';

  if (!subject || !page) {
    return c.json({ error: 'Missing subject or page' }, 400);
  }

  const index = await getIndex(c.env.FILES);
  const segments = resolvePathSegments(subject, page);
  const subtree = getSubtree(index, segments);

  if (subtree === null || typeof subtree === 'string') {
    return yearsOnly ? c.json({ years: [] }) : c.json({ content: {} });
  }

  if (yearsOnly) {
    return c.json({ years: extractYears(subtree as FileStructure) });
  }

  return c.json({ content: subtree });
});

/**
 * GET /file/:key+ → Serve a file from R2
 */
app.get('/file/*', async (c) => {
  const key = c.req.path.replace(/^\/file\//, '');
  if (!key) return c.text('Not Found', 404);

  const object = await c.env.FILES.get(key);
  if (!object) return c.text('Not Found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});

/**
 * POST /upload — Upload a single PDF to R2 (from the web form).
 */
app.post('/upload', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !isValidAuth(authHeader, c.env.UPLOAD_PASSWORD)) {
    return c.text('Neautorizat', 401);
  }

  const contentType = c.req.header('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.text('Tip de conținut neacceptat', 415);
  }

  let formData: FormData;
  try {
    formData = await c.req.raw.formData();
  } catch {
    return c.text('Eroare la citirea datelor', 400);
  }

  const page = formData.get('page') as string;
  const year = formData.get('year') as string;
  const title = formData.get('title') as string;
  const type = formData.get('type') as string;
  const type2 = formData.get('type2') as string;
  const testNumber = formData.get('testNumber') as string;
  const simulation = formData.get('simulation') as string;
  const county = formData.get('county') as string;
  const local = formData.get('local') as string;
  const file = formData.get('file') as unknown as File;

  if (!page || !year || !type || !type2 || !file) {
    return c.text('Date lipsă: Câmpuri obligatorii lipsă', 400);
  }

  const { r2Key, fileName } = generateUploadPath({
    page, year, title, type, type2, testNumber, simulation, county, local,
  });

  await c.env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: 'application/pdf' },
  });

  const index = await getIndex(c.env.FILES);
  const segments = r2Key.split('/');
  setInIndex(index, segments, r2Key);
  await putIndex(c.env.FILES, index);

  return c.text(`Fișier încărcat cu succes: ${fileName}`, 200);
});

/**
 * POST /upload-scraper — Bulk upload from the watchtower/scraper.
 * Accepts multipart with: password, key (R2 path), file (PDF blob).
 */
app.post('/upload-scraper', async (c) => {
  const contentType = c.req.header('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.text('Unsupported content type', 415);
  }

  let formData: FormData;
  try {
    formData = await c.req.raw.formData();
  } catch {
    return c.text('Failed to parse form data', 400);
  }

  const password = formData.get('password') as string;
  if (password !== c.env.UPLOAD_PASSWORD) {
    return c.text('Unauthorized', 401);
  }

  const key = formData.get('key') as string;
  const file = formData.get('file') as unknown as File;

  if (!key || !file) {
    return c.text('Missing key or file', 400);
  }

  // Reject path traversal attempts
  if (key.includes('..') || key.startsWith('/')) {
    return c.text('Invalid key', 400);
  }

  await c.env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: 'application/pdf' },
  });

  const index = await getIndex(c.env.FILES);
  const segments = key.split('/');
  setInIndex(index, segments, key);
  await putIndex(c.env.FILES, index);

  return c.json({ success: true, key });
});

/**
 * GET /page-data?subject=X&page=Y
 * Returns { content, extra, years } in one request.
 */
app.get('/page-data', async (c) => {
  const subject = c.req.query('subject');
  const page = c.req.query('page');

  if (!subject || !page) {
    return c.json({ error: 'Missing subject or page' }, 400);
  }

  const index = await getIndex(c.env.FILES);

  // Main content + years
  const segments = resolvePathSegments(subject, page);
  const subtree = getSubtree(index, segments);
  const content: FileStructure = (subtree !== null && typeof subtree !== 'string')
    ? (subtree as FileStructure)
    : {};
  const years = extractYears(content);

  // Extra content
  const isAdmitere = subject.toLowerCase() === 'admitere';
  const extraPage = isAdmitere ? `${page}/extra` : 'extra';
  const extraSegments = resolvePathSegments(isAdmitere ? 'admitere' : subject, extraPage);
  const extraSubtree = getSubtree(index, extraSegments);
  const extra: FileStructure = (extraSubtree !== null && typeof extraSubtree !== 'string')
    ? (extraSubtree as FileStructure)
    : {};

  return c.json({ content, extra, years });
});

/**
 * GET /structure — Return subjects → pages map derived from the index.
 * Used by the SSG build to generate static paths dynamically.
 */
app.get('/structure', async (c) => {
  const index = await getIndex(c.env.FILES);
  const structure: Record<string, string[]> = {};

  for (const [subject, value] of Object.entries(index)) {
    if (typeof value !== 'object' || value === null) continue;
    const branch = value as FileStructure;

    if (subject === 'admitere') {
      // admitere's "pages" are its direct children (e.g. fizica, info, mate)
      structure[subject] = Object.keys(branch).filter(
        (k) => typeof branch[k] === 'object' && branch[k] !== null,
      );
    } else if ('pages' in branch && typeof branch.pages === 'object') {
      structure[subject] = Object.keys(branch.pages as FileStructure);
    }
  }

  return c.json(structure);
});

/**
 * GET /index — Return the full index (for debugging / migration).
 */
app.get('/index', async (c) => {
  const index = await getIndex(c.env.FILES);
  return c.json(index);
});

// ── Upload path generation ─────────────────────────────────────────────────────

/** Strip characters that could cause path traversal or unexpected R2 keys. */
const sanitizePathSegment = (s: string): string =>
  s.replace(/[^a-zA-Z0-9_\-ăîșțâĂÎȘȚÂ ]/g, '').trim();

interface UploadPathData {
  page: string;
  year: string;
  title: string;
  type: string;
  type2: string;
  testNumber: string;
  simulation: string;
  county: string;
  local: string;
}

function generateUploadPath(data: UploadPathData): { r2Key: string; fileName: string } {
  const { page, year, type, type2, testNumber, simulation } = data;
  const title = sanitizePathSegment(data.title);
  const county = sanitizePathSegment(data.county);
  const local = sanitizePathSegment(data.local);
  let r2Key = '';
  let fileName = '';

  if (page === 'bac') {
    fileName = `E_d_fizica_teoretic_vocational_${year}_${type2}_${type}.pdf`;
    r2Key = `fizica/pages/bac/${year}/${title}/${fileName}`;
  } else if (page === 'teste') {
    fileName = `E_d_fizica_${year}_${type2}_${testNumber}.pdf`;
    r2Key = `fizica/pages/teste-de-antrenament/${year}/${fileName}`;
  } else if (page === 'sim') {
    const location = simulation === 'judetene' ? county : local;
    fileName = `E_d_fizica_${location}_${year}_${type2}.pdf`;
    r2Key = `fizica/pages/simulari-judetene/${year}/${fileName}`;
  }

  return { r2Key, fileName };
}

export default app;