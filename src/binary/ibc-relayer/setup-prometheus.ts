import http from 'http';

import client from 'prom-client';

import { Logger } from '../create-logger';

let initialized = false;

function getMetrics() {
  return {
    pollCounter: new client.Counter({
      name: 'poll_counter',
      help: 'Poll counter',
    }),
  };
}

export type Metrics = ReturnType<typeof setupPrometheus>;
export function setupPrometheus({
  enabled,
  port,
  logger,
}: {
  enabled: boolean;
  port: number;
  logger: Logger;
}) {
  if (initialized) {
    throw new Error(
      `"setupPrometheus" func shouldn't be initialized more than once.`
    );
  }
  initialized = true;

  if (!enabled) {
    return null;
  }

  client.collectDefaultMetrics({ prefix: 'confio_relayer_' });
  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/metrics') {
      const metrics = await client.register.metrics();
      response.writeHead(200, {
        'Content-Type': client.register.contentType,
      });
      response.end(metrics);

      return;
    }

    response.writeHead(404);
    response.end('404');
  });
  server.listen(port);
  logger.info(`Prometheus GET /metrics exposed on port ${port}.`);

  return getMetrics();
}
