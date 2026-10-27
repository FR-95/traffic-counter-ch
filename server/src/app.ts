import { existsSync } from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import type { TrafficStore } from './store.ts';

// Vektorkacheln von swisstopo: tiles.json auf vectortiles, die Kacheln selbst auf vectortiles0–4.
const TILE_HOSTS = ['https://vectortiles.geo.admin.ch', ...[0, 1, 2, 3, 4].map((n) => `https://vectortiles${n}.geo.admin.ch`)];

export function createApp(store: TrafficStore, staticDir?: string): Hono {
  const app = new Hono();

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", ...TILE_HOSTS],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );
  app.use('/api/*', compress());

  app.get('/api/health', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(store.health());
  });

  app.get('/api/counters', (c) => {
    if (!store.counters) return c.json({ error: store.unavailableReason('sites') }, 503);
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(store.counters);
  });

  app.get('/api/measurements', (c) => {
    if (!store.measurements) return c.json({ error: store.unavailableReason('measurements') }, 503);
    c.header('Cache-Control', 'public, max-age=15');
    return c.json(store.measurements);
  });

  app.all('/api/*', (c) => c.json({ error: 'Nicht gefunden' }, 404));

  if (staticDir && existsSync(staticDir)) {
    const root = path.relative(process.cwd(), staticDir);
    app.use('/*', serveStatic({ root }));
    app.get('*', serveStatic({ path: path.join(root, 'index.html') }));
  }

  return app;
}
