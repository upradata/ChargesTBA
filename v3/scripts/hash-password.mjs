import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const input = createInterface({ input: process.stdin, output: process.stdout });
const password = await input.question('Password: ');
const existingSalt = await input.question('Existing salt (leave empty for a new one): ');
input.close();

const salt = existingSalt || randomBytes(16).toString('hex');
const hash = scryptSync(password.normalize('NFKC'), salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 67108864,
}).toString('hex');

console.log(`${salt}:${hash}`);
