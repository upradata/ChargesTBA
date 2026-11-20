import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createApp } from './app';
import { openDatabase } from './db';

const origin = 'http://127.0.0.1:5173';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => {
    for (const store of stores.splice(0)) store.sqlite.close();
});

describe('comptabilité des remboursements', () => {
    it('migre une base version 3 sans modifier les données comptables existantes', () => {
        const directory = mkdtempSync(join(tmpdir(), 'charges-v3-to-v4-'));
        const path = join(directory, 'db.sqlite');
        try {
            const old = openDatabase(path);
            old.sqlite.exec(`
                INSERT INTO "user" (id, name, email, createdAt, updatedAt)
                    VALUES ('u', 'Test', 'migration@example.com', 0, 0);
                INSERT INTO charges VALUES ('c', 'u', 'Charge historique', 'Test', '2026-01-01', 1000, 1);
                INSERT INTO payments (id, user_id, date, category, amount)
                    VALUES ('p', 'u', '2026-01-02', 'Virement', 200);
                INSERT INTO allocations VALUES ('a', 'p', 'c', 200);
                DROP TABLE csv_mapping_rules;
                DROP TABLE payment_types;
                DROP TABLE csv_mappings_initialized;
                DROP TABLE refund_applications;
                DROP TABLE refunds;
                PRAGMA user_version = 3;
            `);
            old.sqlite.close();

            const migrated = openDatabase(path);
            expect(migrated.sqlite.pragma('user_version', { simple: true })).toBe(5);
            expect(migrated.sqlite.prepare('SELECT amount FROM charges WHERE id = ?').get('c')).toEqual({
                amount: 1000,
            });
            expect(migrated.sqlite.prepare('SELECT amount FROM allocations WHERE id = ?').get('a')).toEqual({
                amount: 200,
            });
            expect(migrated.sqlite.prepare('SELECT COUNT(*) AS count FROM refunds').get()).toEqual({ count: 0 });
            migrated.sqlite.exec(`
                INSERT INTO categories (id, user_id, name) VALUES ('category', 'u', 'Test');
                INSERT INTO refunds VALUES ('r', 'u', '2026-01-03', 'Avoir', 'category', 100);
                INSERT INTO refund_applications VALUES ('ra', 'r', 'c', 100);
            `);
            migrated.sqlite.close();

            const reopened = openDatabase(path);
            try {
                expect(reopened.sqlite.pragma('user_version', { simple: true })).toBe(5);
                expect(reopened.sqlite.prepare('SELECT amount FROM refunds WHERE id = ?').get('r')).toEqual({
                    amount: 100,
                });
                expect(
                    reopened.sqlite.prepare('SELECT amount FROM refund_applications WHERE id = ?').get('ra'),
                ).toEqual({
                    amount: 100,
                });
                expect(reopened.sqlite.pragma('foreign_key_check')).toEqual([]);
            } finally {
                reopened.sqlite.close();
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it('expose les remboursements par compte et les soustrait de la capacité sans les compter comme paiements', async () => {
        const store = openDatabase(':memory:');
        stores.push(store);
        const { app } = createApp(store, 'a-long-random-secret-for-testing-only-12345', origin);
        const request = (path: string, method = 'GET', body?: unknown, cookie?: string) =>
            app.request(path, {
                method,
                headers: {
                    origin,
                    ...(body ? { 'content-type': 'application/json' } : {}),
                    ...(cookie ? { cookie } : {}),
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
        const signup = async (email: string) => {
            const res = await request('/api/auth/sign-up/email', 'POST', {
                name: 'Test',
                email,
                password: 'a-secure-password',
            });
            expect(res.status).toBe(200);
            return res.headers
                .getSetCookie()
                .map(value => value.split(';')[0])
                .join('; ');
        };
        const owner = await signup('refund-owner@example.com');
        const other = await signup('refund-other@example.com');
        const settings = (await (await request('/api/settings', 'GET', undefined, owner)).json()) as {
            categories: { id: string; name: string }[];
        };
        const category = settings.categories[0];
        const created = await request(
            '/api/charges',
            'POST',
            { title: 'Charge', category: 'Test', date: '2026-01-01', amount: 10000, installments: 1 },
            owner,
        );
        expect(created.status).toBe(201);
        const { id: chargeId } = (await created.json()) as { id: string };
        const user = store.sqlite.prepare('SELECT id FROM "user" WHERE email = ?').get('refund-owner@example.com') as {
            id: string;
        };
        store.sqlite
            .prepare('INSERT INTO payments (id, user_id, date, category, amount) VALUES (?, ?, ?, ?, ?)')
            .run('payment', user.id, '2026-01-02', 'Virement', 2000);
        store.sqlite
            .prepare('INSERT INTO allocations VALUES (?, ?, ?, ?)')
            .run('allocation', 'payment', chargeId, 2000);
        store.sqlite
            .prepare('INSERT INTO refunds VALUES (?, ?, ?, ?, ?, ?)')
            .run('refund', user.id, '2026-01-03', 'Avoir', category.id, 3000);
        store.sqlite
            .prepare('INSERT INTO refund_applications VALUES (?, ?, ?, ?)')
            .run('refund-application', 'refund', chargeId, 1500);

        const charges = (await (await request('/api/charges', 'GET', undefined, owner)).json()) as {
            paid: number;
            refunded: number;
            available: number;
        }[];
        expect(charges[0]).toMatchObject({ paid: 2000, refunded: 1500, available: 6500 });
        const refunds = (await (await request('/api/refunds', 'GET', undefined, owner)).json()) as {
            category: string;
            appliedAmount: number;
            unappliedAmount: number;
            applications: { chargeId: string; amount: number }[];
        }[];
        expect(refunds).toEqual([
            {
                id: 'refund',
                userId: user.id,
                date: '2026-01-03',
                title: 'Avoir',
                categoryId: category.id,
                category: category.name,
                amount: 3000,
                appliedAmount: 1500,
                unappliedAmount: 1500,
                applications: [{ id: 'refund-application', refundId: 'refund', chargeId, amount: 1500 }],
            },
        ]);
        expect(await (await request('/api/refunds', 'GET', undefined, other)).json()).toEqual([]);
        expect((await request('/api/refunds')).status).toBe(401);

        const update = (changes: { amount?: number; category?: string }) =>
            request(
                `/api/charges/${chargeId}`,
                'PUT',
                {
                    title: 'Charge',
                    category: 'Test',
                    date: '2026-01-01',
                    amount: 10000,
                    installments: 1,
                    ...changes,
                },
                owner,
            );
        expect((await update({ amount: 3499 })).status).toBe(400);
        expect((await update({ category: 'Autre catégorie' })).status).toBe(400);
        expect((await request(`/api/charges/${chargeId}`, 'DELETE', undefined, owner)).status).toBe(400);
        expect((await request(`/api/categories/${category.id}`, 'DELETE', undefined, owner)).status).toBe(400);
        expect(
            (
                await request(
                    '/api/payments',
                    'POST',
                    {
                        date: '2026-01-04',
                        category: 'Virement',
                        amount: 6501,
                        allocations: [{ chargeId, amount: 6501 }],
                    },
                    owner,
                )
            ).status,
        ).toBe(400);
        expect(
            (
                await request(
                    '/api/payments',
                    'POST',
                    {
                        date: '2026-01-04',
                        category: 'Virement',
                        amount: 6500,
                        allocations: [{ chargeId, amount: 6500 }],
                    },
                    owner,
                )
            ).status,
        ).toBe(201);
    });
});
