# CuzaPages

> The largest archive for the Romanian baccalaureate exam — by students, for students.

**Live site:** [cuza.pages.dev](https://cuza.pages.dev)

## Overview

CuzaPages is an open-source study platform that aggregates courses, past exam papers, and notes for Romanian high school students preparing for the baccalaureate. The site covers multiple subjects including Physics, Romanian language, and more.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Astro](https://astro.build) v5 |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| UI components | [React](https://react.dev) v19 |
| Diagrams | [Excalidraw](https://excalidraw.com) |
| Backend / API | [Hono](https://hono.dev) on Cloudflare Workers |
| File storage | Cloudflare R2 |
| Hosting | Cloudflare Pages |
| Package manager | [pnpm](https://pnpm.io) |

## Project Structure

```
cuza.pages.dev/
├── src/
│   ├── components/     # Astro & React components
│   ├── content/info/   # Course markdown files
│   ├── layouts/        # Page layouts
│   └── pages/          # File-based routes
├── public/             # Static assets (fonts, images)
├── cuza-worker/        # Cloudflare Worker (file upload / R2 API)
└── web-scraper/        # Python scraper for sourcing exam papers
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) 10+

### Install & run locally

```bash
pnpm install
pnpm dev
```

The site will be available at `http://localhost:4321`.

### Build for production

```bash
pnpm build
pnpm preview   # serve the built output locally
```

### Cloudflare Worker (backend)

```bash
cd cuza-worker
pnpm install
pnpm dev       # local development
pnpm deploy    # deploy to Cloudflare Workers
```

## Contributing

See [CONTRIBUTE.md](CONTRIBUTE.md) for a full step-by-step guide on how to fork the repo, make changes, and open a pull request.

### Quick summary

1. Fork and clone the repository.
2. Create or edit course files in `src/content/info/`.
3. Add static assets (images, fonts) to `public/`. Exam PDFs are stored on Cloudflare R2 — use the `web-scraper` or the upload page to add files.
4. Open a pull request and wait for review.

For questions or feature requests, open a [GitHub Issue](https://github.com/DynoW/cuza.pages.dev/issues).

## License

The site and Cloudflare Worker are licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). Any fork deployed as a public web service must also publish its source code under AGPL-3.0.

The `web-scraper/` utility is independently licensed under the [MIT License](web-scraper/LICENSE).

Exam PDFs served on the site are produced by the Romanian Ministry of Education and are not covered by either license.
