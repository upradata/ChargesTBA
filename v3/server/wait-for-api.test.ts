import { createServer, type RequestListener } from 'node:http';

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { waitForApi } from './wait-for-api';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
    await Promise.all(
        servers.splice(0).map(
            server =>
                new Promise<void>((resolve, reject) => {
                    server.close(error => (error ? reject(error) : resolve()));
                    server.closeAllConnections();
                }),
        ),
    );
});

async function startServer(handler: RequestListener) {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server port');
    return { server, url: `http://127.0.0.1:${address.port}/api/auth/get-session` };
}

describe('development API readiness', () => {
    it('waits for a successful session response before allowing the client to start', async () => {
        let requests = 0;
        const { url } = await startServer((_request, response) => {
            requests += 1;
            response.writeHead(requests === 1 ? 503 : 200).end('null');
        });
        await expect(waitForApi(url, 2000)).resolves.toBeUndefined();
        expect(requests).toBe(2);
    });

    it('retries connection refusals while the API is starting', async () => {
        const { server, url } = await startServer((_request, response) => response.end('null'));
        await new Promise<void>((resolve, reject) => {
            server.close(error => (error ? reject(error) : resolve()));
        });
        const ready = waitForApi(url, 2000);
        await new Promise(resolve => setTimeout(resolve, 50));
        await new Promise<void>(resolve => server.listen(Number(new URL(url).port), '127.0.0.1', resolve));
        await expect(ready).resolves.toBeUndefined();
    });

    it('reports an unavailable API instead of starting the client', async () => {
        const { url } = await startServer((_request, response) => response.writeHead(503).end());
        await expect(waitForApi(url, 100)).rejects.toThrow('API indisponible');
    });

    it('times out even when the API accepts connections without responding', async () => {
        const { url } = await startServer(() => {});
        await expect(waitForApi(url, 100)).rejects.toThrow('API indisponible');
    }, 2000);
});
