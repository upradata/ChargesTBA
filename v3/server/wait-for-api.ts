import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function waitForApi(url: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    let lastFailure: unknown;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
            });
            await response.body?.cancel();
            if (response.ok) return;
            lastFailure = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastFailure = error;
        }
        await setTimeout(Math.min(100, Math.max(0, deadline - Date.now())));
    }
    throw new Error(`API indisponible après ${timeoutMs} ms : ${url}`, { cause: lastFailure });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await waitForApi('http://127.0.0.1:3001/api/auth/get-session');
}
