import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { type Bindings, registerRoutes } from '../../cuza-worker/src/app';

const app = new Hono<{ Bindings: Bindings }>();

app.basePath('/api');

registerRoutes(app as any);

export const onRequest = handle(app);
