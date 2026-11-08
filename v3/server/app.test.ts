import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createApp } from './app';
import { openDatabase } from './db';

const origin = 'http://127.0.0.1:5173';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => {
    for (const store of stores.splice(0)) store.sqlite.close();
});

describe('API locale', () => {
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
