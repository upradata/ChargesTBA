import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { verifyPassword } from 'better-auth/crypto';
import { expect, it } from 'vite-plus/test';

function runScript(password: string, salt: string) {
    return new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(new URL('./hash-password.mjs', import.meta.url))]);
        let output = '';
        let step = 0;
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            output += chunk;
            if (step === 0 && output.includes('Password: ')) {
                step = 1;
                child.stdin.write(`${password}\n`);
            }
            if (step === 1 && output.includes('Existing salt (leave empty for a new one): ')) {
                step = 2;
                child.stdin.end(`${salt}\n`);
            }
        });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) return reject(new Error(`Hash script exited with code ${code}`));
            const hash = output.match(/[0-9a-f]{32}:[0-9a-f]{128}/)?.[0];
            if (!hash) return reject(new Error('Hash script did not produce a hash'));
            resolve(hash);
        });
    });
}

it('generates and reproduces Better Auth password hashes', async () => {
    const hash = await runScript('pa\u212Assword', '');
    const [salt] = hash.split(':');

    expect(await verifyPassword({ hash, password: 'paKssword' })).toBe(true);
    expect(await runScript('paKssword', salt)).toBe(hash);
    expect(await verifyPassword({ hash, password: 'wrong-password' })).toBe(false);
});
