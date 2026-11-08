import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app';
import { openDatabase } from './db';

const store = openDatabase();
const secretPath = resolve('.data/auth-secret');
if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
chmodSync(secretPath, 0o600);
const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
const { app } = createApp(store, readFileSync(secretPath, 'utf8').trim(), origin);
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3001 }, () => {
    console.info('API locale disponible sur http://127.0.0.1:3001');
});
