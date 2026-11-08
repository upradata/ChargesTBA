import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const charges = sqliteTable('charges', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    date: text('date').notNull(),
    amount: integer('amount').notNull(),
    installments: integer('installments').notNull(),
});

export const payments = sqliteTable('payments', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    date: text('date').notNull(),
    category: text('category').notNull(),
    label: text('label'),
    amount: integer('amount').notNull(),
});

export const allocations = sqliteTable('allocations', {
    id: text('id').primaryKey(),
    paymentId: text('payment_id').notNull(),
    chargeId: text('charge_id').notNull(),
    amount: integer('amount').notNull(),
});

export function openDatabase(path = resolve('.data/charges.sqlite')) {
    if (path !== ':memory:') mkdirSync(resolve(path, '..'), { recursive: true, mode: 0o700 });
    const sqlite = new Database(path);
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    const version = sqlite.pragma('user_version', { simple: true });
    if (version === 0) {
        sqlite.transaction(() => {
            sqlite.exec(`
        CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
          emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
        CREATE TABLE session (id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
          createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT,
          userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE);
        CREATE TABLE account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
          userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT,
          idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT,
          createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
        CREATE TABLE verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
          expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
        CREATE TABLE charges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          title TEXT NOT NULL, category TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
          installments INTEGER NOT NULL CHECK(installments > 0));
        CREATE TABLE payments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          date TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0));
        CREATE TABLE allocations (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
          charge_id TEXT NOT NULL REFERENCES charges(id) ON DELETE CASCADE, amount INTEGER NOT NULL CHECK(amount > 0));
        CREATE INDEX charges_user ON charges(user_id);
        CREATE INDEX payments_user ON payments(user_id);
        CREATE INDEX allocations_charge ON allocations(charge_id);
        PRAGMA user_version = 1;
      `);
        })();
    } else if (version !== 1 && version !== 2) {
        throw new Error(`Version de base de données non prise en charge : ${String(version)}`);
    }
    if (version === 0 || version === 1) {
        sqlite.transaction(() => {
            sqlite.exec('ALTER TABLE payments ADD COLUMN label TEXT; PRAGMA user_version = 2;');
        })();
    }
    return { sqlite, db: drizzle(sqlite) };
}
