import { Server } from 'http';

export function configureServer(server: Server): void {
  // Increase timeout for streaming requests
  server.timeout = 5 * 60 * 1000;
  server.keepAliveTimeout = 61000;
  server.headersTimeout = 62000;
}