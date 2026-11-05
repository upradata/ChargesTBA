import { copyFile } from 'node:fs/promises';

await copyFile(new URL('../appsscript.json', import.meta.url), new URL('../dist/appsscript.json', import.meta.url));
