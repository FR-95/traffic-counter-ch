import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { createOtdClient } from './otd-client.ts';
import { loadSensors } from './sensors.ts';
import { TrafficStore } from './store.ts';
import { loadTmc } from './tmc.ts';

const store = new TrafficStore({
  pull: createOtdClient({ endpoint: config.endpoint, apiKey: config.apiKey }),
  tmc: loadTmc(config.tmcFile),
  sensors: loadSensors(config.sensorsFile),
  measurementIntervalMs: config.measurementIntervalMs,
  siteTableIntervalMs: config.siteTableIntervalMs,
});
store.start();

const server = serve(
  { fetch: createApp(store, config.staticDir).fetch, hostname: config.host, port: config.port },
  (info) => console.info(`Server läuft auf http://${info.address}:${info.port}`),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    store.stop();
    server.close(() => process.exit(0));
  });
}
