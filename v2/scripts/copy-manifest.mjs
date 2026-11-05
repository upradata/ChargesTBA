import { copyFile, mkdir } from 'node:fs/promises';

await mkdir(new URL('../dist', import.meta.url), { recursive: true });
await copyFile(new URL('../appsscript.json', import.meta.url), new URL('../dist/appsscript.json', import.meta.url));
