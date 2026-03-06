// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Daniel C. (DynoW) — https://github.com/DynoW/cuza.pages.dev

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type Bindings, registerRoutes } from './app';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: (origin) => {
    const allowed = ['https://cuza.pages.dev', 'http://localhost:4321'];
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

registerRoutes(app);

export default app;
