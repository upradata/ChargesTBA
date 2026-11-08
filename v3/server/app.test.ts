import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createApp } from './app';
import { openDatabase } from './db';

const origin = 'http://127.0.0.1:5173';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => {
    for (const store of stores.splice(0)) store.sqlite.close();
});

describe('API locale', () => {
    it('migre les échéances historiques sans modifier les paiements affectés', () => {
        const directory = mkdtempSync(join(tmpdir(), 'charges-migration-'));
        const path = join(directory, 'db.sqlite');
        try {
            const old = openDatabase(path);
            old.sqlite
                .prepare('INSERT INTO "user" (id, name, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
                .run('u', 'Test', 'u@example.com', 0, 0);
            old.sqlite
                .prepare('INSERT INTO charges VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run('c', 'u', 'Charge', 'Ancienne catégorie', '2024-01-31', 1000, 3);
            old.sqlite
                .prepare('INSERT INTO payments VALUES (?, ?, ?, ?, ?)')
                .run('p', 'u', '2024-02-01', 'Virement', 200);
            old.sqlite.prepare('INSERT INTO allocations VALUES (?, ?, ?, ?)').run('a', 'p', 'c', 200);
            old.sqlite.exec(
                'DROP TABLE charge_installments; DROP TABLE categories; DROP TABLE schedule_templates; DROP TABLE settings_initialized; PRAGMA user_version = 1',
            );
            old.sqlite.close();
            const migrated = openDatabase(path);
            expect(
                migrated.sqlite
                    .prepare('SELECT date, amount FROM charge_installments WHERE charge_id = ? ORDER BY position')
                    .all('c'),
            ).toEqual([
                { date: '2024-01-31', amount: 334 },
                { date: '2024-02-29', amount: 333 },
                { date: '2024-03-31', amount: 333 },
            ]);
            expect(migrated.sqlite.prepare('SELECT amount FROM allocations WHERE id = ?').get('a')).toEqual({
                amount: 200,
            });
            expect(migrated.sqlite.pragma('user_version', { simple: true })).toBe(2);
            migrated.sqlite.close();
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it('isole les paramètres et conserve les échéances après modification des modèles', async () => {
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
        async function signup(email: string) {
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
        }
        const first = await signup('settings-first@example.com');
        const second = await signup('settings-second@example.com');
        const settings = (await (await request('/api/settings', 'GET', undefined, first)).json()) as {
            categories: { id: string; name: string }[];
            templates: { id: string; name: string; rules: { monthOffset: number; day: number; weight: number }[] }[];
        };
        expect(settings.categories.map(row => row.name)).toContain('Appel de fonds trimestriel');
        expect(settings.templates[0].rules.map(row => row.monthOffset)).toEqual([1, 2, 3]);
        const template = settings.templates[0];
        expect(
            (await request(`/api/templates/${template.id}`, 'PUT', { name: 'Volé', rules: template.rules }, second))
                .status,
        ).toBe(404);
        expect(
            (await request('/api/categories', 'POST', { name: 'Privée', defaultScheduleId: template.id }, second))
                .status,
        ).toBe(400);
        const schedule = [
            { date: '2026-03-01', amount: 300 },
            { date: '2026-04-15', amount: 700 },
        ];
        const input = {
            title: 'Charge',
            category: 'Appel',
            date: '2026-02-01',
            amount: 1000,
            installments: 2,
            schedule,
        };
        expect(
            (
                await request(
                    '/api/charges',
                    'POST',
                    { ...input, schedule: [{ ...schedule[0], amount: 299 }, schedule[1]] },
                    first,
                )
            ).status,
        ).toBe(400);
        expect((await request('/api/charges', 'POST', input, first)).status).toBe(201);
        expect(
            (
                await request(
                    `/api/templates/${template.id}`,
                    'PUT',
                    { name: 'Modifié', rules: [{ monthOffset: 4, day: 5, weight: 1 }] },
                    first,
                )
            ).status,
        ).toBe(200);
        const charges = (await (await request('/api/charges', 'GET', undefined, first)).json()) as {
            schedule: typeof schedule;
        }[];
        expect(charges[0].schedule).toEqual(schedule);
        expect((await request(`/api/templates/${template.id}`, 'DELETE', undefined, second)).status).toBe(404);
        expect(await (await request('/api/charges', 'GET', undefined, second)).json()).toEqual([]);
    });

    it('isole les comptes et valide les répartitions de manière atomique', async () => {
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
        const first = await signup('first@example.com');
        const second = await signup('second@example.com');
        expect((await request('/api/charges')).status).toBe(401);
        const crossOrigin = await app.request('/api/charges', {
            method: 'POST',
            headers: { 'origin': 'https://other.example.com', 'content-type': 'application/json', 'cookie': first },
            body: JSON.stringify({ title: 'X', category: 'X', date: '2026-01-01', amount: 100, installments: 1 }),
        });
        expect(crossOrigin.status).toBe(403);
        const created = await request(
            '/api/charges',
            'POST',
            {
                title: 'Trimestre',
                category: 'Appel',
                date: '2026-01-31',
                amount: 10000,
                installments: 3,
            },
            first,
        );
        expect(created.status).toBe(201);
        const { id } = (await created.json()) as { id: string };
        expect(await (await request('/api/charges', 'GET', undefined, second)).json()).toEqual([]);
        const payment = (cookie: string, allocated: number) =>
            request(
                '/api/payments',
                'POST',
                {
                    date: '2026-02-01',
                    category: 'Virement',
                    amount: 12000,
                    allocations: [{ chargeId: id, amount: allocated }],
                },
                cookie,
            );
        expect((await payment(second, 100)).status).toBe(400);
        expect((await payment(first, 10001)).status).toBe(400);
        expect(await (await request('/api/payments', 'GET', undefined, first)).json()).toEqual([]);
        expect((await payment(first, 5000)).status).toBe(201);
        const chargeRows = (await (await request('/api/charges', 'GET', undefined, first)).json()) as {
            paid: number;
        }[];
        expect(chargeRows[0].paid).toBe(5000);
        const updatedCharge = {
            title: 'Rectifiée',
            category: 'Appel',
            date: '2026-02-28',
            amount: 4999,
            installments: 2,
        };
        expect((await request(`/api/charges/${id}`, 'PUT', updatedCharge, first)).status).toBe(400);
        expect((await request(`/api/charges/${id}`, 'PUT', { ...updatedCharge, amount: 10000 }, second)).status).toBe(
            400,
        );
        expect((await request(`/api/charges/${id}`, 'PUT', { ...updatedCharge, amount: 10000 }, first)).status).toBe(
            200,
        );
        const paymentRows = (await (await request('/api/payments', 'GET', undefined, first)).json()) as {
            amount: number;
            allocated: number;
        }[];
        expect(paymentRows[0].amount - paymentRows[0].allocated).toBe(7000);
        expect((await payment(first, 5001)).status).toBe(400);
        const storedPayment = store.sqlite.prepare('SELECT id FROM payments').get() as { id: string };
        expect(
            (
                await request(
                    `/api/payments/${storedPayment.id}`,
                    'PUT',
                    {
                        date: '2026-02-01',
                        category: 'Virement',
                        amount: 4999,
                    },
                    first,
                )
            ).status,
        ).toBe(400);
        const allocate = (cookie: string, value: number) =>
            request(
                `/api/payments/${storedPayment.id}/allocations`,
                'POST',
                {
                    allocations: [{ chargeId: id, amount: value }],
                },
                cookie,
            );
        expect((await allocate(second, 100)).status).toBe(400);
        expect((await allocate(first, 5001)).status).toBe(400);
        expect((await allocate(first, 5000)).status).toBe(200);
        const finalCharge = (await (await request('/api/charges', 'GET', undefined, first)).json()) as {
            paid: number;
        }[];
        expect(finalCharge[0].paid).toBe(10000);
    });
});
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
