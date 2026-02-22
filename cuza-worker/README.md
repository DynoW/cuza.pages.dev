# Cloudflare worker for cuza.pages.dev

> SPDX-License-Identifier: AGPL-3.0-only

Test locally

```txt
pnpm install
pnpm run dev
```

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
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

> Copyright (c) 2026 Daniel C. (DynoW) — https://github.com/DynoW/cuza.pages.dev
> See [LICENSE](LICENSE) for details.