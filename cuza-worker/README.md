# Cloudflare worker for cuza.pages.dev

> SPDX-License-Identifier: AGPL-3.0-only

Test locally

```txt
pnpm install
pnpm run dev
```

Recent uploads

```txt
GET /recent-changes?limit=20
```

Returns the latest uploaded files (newest first) from both `/upload` and `/upload-scraper`.
`limit` is optional and clamped between 1 and 100.

Auth

Protected POST routes (`/upload`, `/upload-scraper`, `/cleanup-index`, `/trigger-deploy`) use:

`Authorization: Bearer <base64(username:UPLOAD_PASSWORD)>`

Deploy

```txt
pnpm run deploy
```

(Optional) use cloudfalre bindings:

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
pnpm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

> Copyright (c) 2026 Daniel C. (DynoW) — https://github.com/DynoW/cuza.pages.dev
> See [LICENSE](LICENSE) for details
