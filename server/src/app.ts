import { existsSync } from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import type { TrafficStore } from './store.ts';

const TILE_HOSTS = ['https://wmts.geo.admin.ch', 'https://tile.osm.ch'];

export function createApp(store: TrafficStore, staticDir?: string): Hono {
  const app = new Hono();

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', ...TILE_HOSTS],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );
  app.use('/api/*', compress());

  app.get('/api/health', (c) => c.json(store.health()));

  app.get('/api/counters', (c) => {
    if (!store.counters) return c.json({ error: 'Messstellen werden noch geladen' }, 503);
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(store.counters);
  });

  app.get('/api/measurements', (c) => {
    if (!store.measurements) return c.json({ error: 'Messwerte werden noch geladen' }, 503);
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
