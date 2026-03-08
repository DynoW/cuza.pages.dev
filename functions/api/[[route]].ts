import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { type Bindings } from '../../cuza-worker/src/app';

const app = new Hono<{ Bindings: Bindings }>();

app.basePath('/api');

app.get('/ping', (c) => c.text('Pong!', 200));

app.get('/file/:key{.*}', async (c) => {
  const key = c.req.param('key');
  if (!key) return c.text('Not Found', 404);

  const object = await c.env.FILES.get(key);
  if (!object) return c.text('Not Found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});

export const onRequest = handle(app);
