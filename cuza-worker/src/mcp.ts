// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Daniel C. (DynoW) — https://github.com/DynoW/cuza.pages.dev
//
// Agent surface for the CuzaPages archive: MCP (Streamable HTTP), MCP server
// card, API catalog, OpenAPI and llms.txt. Read-only; mounts on the existing
// cuza-worker at https://api.my-lab.ro.

import type { Hono } from 'hono';
import { getIndex, getRecentChanges, type Bindings, type FileStructure } from './app';

const SERVER_NAME = 'cuza-archive';
const SERVER_VERSION = '1.0.0';
const PROTOCOL_VERSION = '2025-06-18';
const BASE = 'https://api.my-lab.ro';
const SITE = 'https://cuza.pages.dev';

type Json = Record<string, unknown>;

interface Leaf {
  path: string;
  subject: string;
  page?: string;
  filename: string;
  key: string;
  url: string;
}

/** Flatten the R2 index into downloadable leaves. */
function flattenLeaves(index: FileStructure): Leaf[] {
  const out: Leaf[] = [];
  const walk = (node: FileStructure, trail: string[]) => {
    for (const [name, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        const parts = [...trail, name];
        const clean = parts.filter((p) => p !== 'pages');
        out.push({
          path: parts.join('/'),
          subject: clean[0] ?? '',
          page: clean[1],
          filename: name,
          key: value,
          url: `${BASE}/file/${value.split('/').map(encodeURIComponent).join('/')}`,
        });
      } else if (value && typeof value === 'object') {
        walk(value as FileStructure, [...trail, name]);
      }
    }
  };
  walk(index, []);
  return out;
}

const TOOLS = [
  {
    name: 'search_files',
    description:
      'Search the CuzaPages archive (Romanian baccalaureate / university-admission exam PDFs) by filename. Returns matching files with subject, section, filename and a direct download URL.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Case-insensitive substring, e.g. "fizica 2024" or "barem".' },
        subject: { type: 'string', description: 'Optional subject filter, e.g. "fizica", "mate", "info", "admitere".' },
        page: { type: 'string', description: 'Optional section filter, e.g. "teoretic", "bac".' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max results (default 20).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_section',
    description: 'List children of a subject or section of the archive (subjects → sections → years → files).',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Subject slug, e.g. "fizica". Omit to list all subjects.' },
        page: { type: 'string', description: 'Optional section slug, e.g. "teoretic".' },
      },
    },
  },
  {
    name: 'get_file_url',
    description: 'Resolve an archive key or filename to a direct download URL.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Archive path or key, e.g. "fizica/teoretic/2024/E_d_fizica_teoretic_2024_var_01.pdf".' },
      },
      required: ['path'],
    },
  },
  {
    name: 'recent_changes',
    description: 'Most recently added or replaced files in the archive.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 20.' } },
    },
  },
  {
    name: 'list_subjects',
    description: 'List every subject and its sections in the archive.',
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

function ok(id: unknown, result: Json) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function err(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function callTool(bucket: R2Bucket, name: string, args: Json) {
  const index = await getIndex(bucket);
  switch (name) {
    case 'list_subjects': {
      const structure: Record<string, string[]> = {};
      for (const [subject, value] of Object.entries(index)) {
        if (!value || typeof value !== 'object') continue;
        const branch = value as FileStructure;
        structure[subject] =
          subject === 'admitere'
            ? Object.keys(branch).filter((k) => typeof branch[k] === 'object')
            : branch.pages && typeof branch.pages === 'object'
              ? Object.keys(branch.pages as FileStructure)
              : Object.keys(branch);
      }
      return { subjects: structure };
    }
    case 'list_section': {
      const subject = String(args.subject ?? '');
      const page = args.page ? String(args.page) : undefined;
      if (!subject) {
        return { subjects: Object.keys(index), hint: 'Pass subject to list its sections.' };
      }
      const branch = index[subject];
      if (!branch || typeof branch !== 'object') return { error: `unknown subject: ${subject}` };
      const b = branch as FileStructure;
      const node = page
        ? subject === 'admitere'
          ? (b[page] as FileStructure | undefined)
          : ((b.pages as FileStructure | undefined)?.[page] as FileStructure | undefined)
        : subject === 'admitere'
          ? b
          : ((b.pages as FileStructure | undefined) ?? b);
      if (!node || typeof node !== 'object') return { error: `unknown section: ${subject}/${page}` };
      return { subject, page: page ?? null, children: Object.keys(node) };
    }
    case 'search_files': {
      const q = String(args.query ?? '').toLowerCase();
      const subject = args.subject ? String(args.subject).toLowerCase() : undefined;
      const page = args.page ? String(args.page).toLowerCase() : undefined;
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const leaves = flattenLeaves(index);
      const hits = leaves
        .filter((l) => !subject || l.subject.toLowerCase() === subject)
        .filter((l) => !page || (l.page ?? '').toLowerCase() === page)
        .filter((l) => l.path.toLowerCase().includes(q) || l.filename.toLowerCase().includes(q))
        .slice(0, limit);
      return { query: args.query ?? '', count: hits.length, results: hits };
    }
    case 'get_file_url': {
      const raw = String(args.path ?? '').replace(/^\/+/, '');
      const leaves = flattenLeaves(index);
      const hit =
        leaves.find((l) => l.key === raw || l.path === raw) ??
        leaves.find((l) => l.filename === raw) ??
        leaves.find((l) => l.key.endsWith('/' + raw) || l.path.endsWith('/' + raw));
      return hit ?? { error: `not found: ${raw}` };
    }
    case 'recent_changes': {
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const changes = await getRecentChanges(bucket);
      return { changes: changes.slice(0, limit) };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

export function registerMcp(app: Hono<{ Bindings: Bindings }>): void {
  app.options('/mcp', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id');
    return c.body(null, 204);
  });

  app.get('/mcp', (c) => {
    c.header('Allow', 'POST, OPTIONS');
    return c.json(err(null, -32000, 'Use POST for JSON-RPC (Streamable HTTP). SSE stream not provided.'), 405);
  });

  app.post('/mcp', async (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    let body: Json;
    try {
      body = await c.req.json<Json>();
    } catch {
      return c.json(err(null, -32700, 'Parse error'), 400);
    }
    const id = body.id;
    const method = String(body.method ?? '');
    const params = (body.params ?? {}) as Json;

    // Notifications have no id: acknowledge without a JSON-RPC response body.
    if (id === undefined || id === null) {
      return c.body(null, 202);
    }

    switch (method) {
      case 'initialize':
        return c.json(
          ok(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: SERVER_NAME, title: 'CuzaPages archive', version: SERVER_VERSION },
            instructions:
              'Read-only access to the CuzaPages archive of Romanian baccalaureate and admission exam PDFs. Use search_files, list_section, get_file_url, recent_changes. Always cite the returned URL.',
          }),
        );
      case 'ping':
        return c.json(ok(id, {}));
      case 'tools/list':
        return c.json(ok(id, { tools: TOOLS }));
      case 'tools/call': {
        const name = String(params.name ?? '');
        const args = (params.arguments ?? {}) as Json;
        if (!TOOLS.some((t) => t.name === name)) return c.json(err(id, -32602, `Unknown tool: ${name}`));
        const data = await callTool(c.env.FILES, name, args);
        const isError = typeof (data as Json).error === 'string';
        return c.json(
          ok(id, {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
            isError,
          }),
        );
      }
      case 'resources/list':
        return c.json(ok(id, { resources: [] }));
      case 'prompts/list':
        return c.json(ok(id, { prompts: [] }));
      default:
        return c.json(err(id, -32601, `Method not found: ${method}`));
    }
  });

  // ── Discovery documents ──────────────────────────────────────────────────────

  app.get('/.well-known/mcp.json', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    return c.json({
      name: SERVER_NAME,
      title: 'CuzaPages archive',
      description:
        'Read-only MCP server over the CuzaPages archive: Romanian baccalaureate and university-admission exam PDFs, barems and notes.',
      version: SERVER_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      transport: { type: 'streamable-http', url: `${BASE}/mcp` },
      capabilities: { tools: {} },
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      website: SITE,
      documentation: `${BASE}/llms.txt`,
      license: 'AGPL-3.0-only',
    });
  });

  app.get('/.well-known/api-catalog', (c) => {
    const items = [
      { href: `${BASE}/structure`, title: 'Archive structure (subject → sections)', type: 'application/json' },
      { href: `${BASE}/index`, title: 'Full archive index', type: 'application/json' },
      { href: `${BASE}/files?subject=fizica&page=teoretic`, title: 'Files for a section', type: 'application/json' },
      { href: `${BASE}/file/{key}`, title: 'Download a file', type: 'application/pdf' },
      { href: `${BASE}/recent-changes`, title: 'Recently added files', type: 'application/json' },
      { href: `${BASE}/mcp`, title: 'MCP endpoint (Streamable HTTP)', type: 'application/json' },
      { href: `${BASE}/openapi.json`, title: 'OpenAPI description', type: 'application/openapi+json' },
    ];
    c.header('Content-Type', 'application/linkset+json');
    c.header('Access-Control-Allow-Origin', '*');
    return c.body(
      JSON.stringify({
        linkset: [
          {
            anchor: `${BASE}/`,
            'service-desc': [{ href: `${BASE}/openapi.json`, type: 'application/openapi+json' }],
            item: items,
          },
        ],
      }),
    );
  });

  app.get('/llms.txt', (c) => {
    c.header('Content-Type', 'text/plain; charset=utf-8');
    const text = [
      '# CuzaPages archive API',
      '',
      `> Read-only JSON API and MCP server for the CuzaPages archive (${SITE}) — Romanian baccalaureate and university-admission exam PDFs, barems and notes.`,
      '',
      '## Endpoints',
      '',
      `- GET ${BASE}/structure — subjects and sections`,
      `- GET ${BASE}/index — full archive index (nested JSON)`,
      `- GET ${BASE}/files?subject=<subject>&page=<section> — files for a section`,
      `- GET ${BASE}/file/<key> — download a PDF`,
      `- GET ${BASE}/recent-changes?limit=<n> — newest files`,
      `- POST ${BASE}/mcp — MCP (Streamable HTTP, JSON-RPC 2.0)`,
      `- GET ${BASE}/.well-known/mcp.json — MCP server card`,
      `- GET ${BASE}/openapi.json — OpenAPI 3.1 description`,
      '',
      '## MCP tools',
      '',
      '- search_files(query, subject?, page?, limit?) — search by filename',
      '- list_section(subject?, page?) — list children',
      '- get_file_url(path) — resolve a key/filename to a URL',
      '- recent_changes(limit?) — newest additions',
      '- list_subjects() — all subjects and sections',
      '',
      '## Usage',
      '',
      'Free to read and index for search and AI answers; cite the returned URL. Bulk mirroring or model training requires permission (AGPL-3.0 applies to the site source, not the exam PDFs).',
      '',
    ].join('\n');
    return c.body(text);
  });

  app.get('/openapi.json', (c) => {
    c.header('Content-Type', 'application/openapi+json');
    return c.json({
      openapi: '3.1.0',
      info: {
        title: 'CuzaPages archive API',
        version: SERVER_VERSION,
        description: 'Read-only access to the CuzaPages archive index and files.',
        license: { name: 'AGPL-3.0-only' },
      },
      servers: [{ url: BASE }],
      paths: {
        '/structure': { get: { operationId: 'getStructure', summary: 'Subjects and sections', responses: { '200': { description: 'OK' } } } },
        '/index': { get: { operationId: 'getIndex', summary: 'Full archive index', responses: { '200': { description: 'OK' } } } },
        '/files': {
          get: {
            operationId: 'listFiles',
            summary: 'Files for a section',
            parameters: [
              { name: 'subject', in: 'query', required: true, schema: { type: 'string' } },
              { name: 'page', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
        '/file/{key}': {
          get: {
            operationId: 'getFile',
            summary: 'Download a file',
            parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'PDF', content: { 'application/pdf': {} } } },
          },
        },
        '/recent-changes': {
          get: {
            operationId: 'recentChanges',
            summary: 'Newest files',
            parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }],
            responses: { '200': { description: 'OK' } },
          },
        },
        '/mcp': { post: { operationId: 'mcp', summary: 'MCP JSON-RPC endpoint', responses: { '200': { description: 'OK' } } } },
      },
    });
  });
}
