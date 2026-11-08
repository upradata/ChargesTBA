import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createApp } from './app';
import { openDatabase } from './db';

const origin = 'http://127.0.0.1:5173';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => {
    for (const store of stores.splice(0)) if (store.sqlite.open) store.sqlite.close();
    vi.restoreAllMocks();
});

describe('import CSV', () => {
    it('prévisualise, confirme les doublons, isole les comptes et réévalue avant import', async () => {
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
            const result = await request('/api/auth/sign-up/email', 'POST', {
                name: 'Test',
                email,
                password: 'a-secure-password',
            });
            expect(result.status).toBe(200);
            return result.headers
                .getSetCookie()
                .map(value => value.split(';')[0])
                .join('; ');
        };
        const first = await signup('first@example.com');
        const second = await signup('second@example.com');
        const csv = 'date;label;type;credit;debit\n2026-01-01;Fonds;Appel;;10,00\n2026-01-02;Janvier;Virement;10,00;';
        const body = { kind: 'solde', csv, commit: false, approvedDuplicates: [] };
        const imported = (cookie: string, payload: unknown) => request('/api/import', 'POST', payload, cookie);
        expect((await request('/api/import', 'POST', body)).status).toBe(401);
        const oversized = await request('/api/import', 'POST', { ...body, csv: 'x'.repeat(6_500_001) }, first);
        expect(oversized.status).toBe(413);
        const preview = (await (await imported(first, body)).json()) as {
            rows: unknown[];
            duplicates: { marker: string }[];
            imported: boolean;
        };
        expect(preview.rows).toHaveLength(2);
        expect(preview.duplicates).toHaveLength(0);
        expect(store.sqlite.prepare('SELECT count(*) AS n FROM charges').get()).toEqual({ n: 0 });
        const valid = { ...body, commit: true };
        expect(((await (await imported(first, valid)).json()) as { imported: boolean }).imported).toBe(true);
        const payments = (await (await request('/api/payments', 'GET', undefined, first)).json()) as {
            id: string;
            label: string;
            allocated: number;
        }[];
        expect(payments[0]).toMatchObject({ label: 'Janvier', allocated: 0 });
        expect(await (await request('/api/payments', 'GET', undefined, second)).json()).toEqual([]);
        const duplicate = (await (await imported(first, body)).json()) as { duplicates: { marker: string }[] };
        expect(duplicate.duplicates).toHaveLength(2);
        expect(((await (await imported(second, body)).json()) as { duplicates: unknown[] }).duplicates).toHaveLength(0);
        expect(((await (await imported(first, valid)).json()) as { imported: boolean }).imported).toBe(false);
        const approved = duplicate.duplicates.map(item => item.marker);
        expect(
            (
                (await (await imported(first, { ...valid, approvedDuplicates: approved })).json()) as {
                    imported: boolean;
                }
            ).imported,
        ).toBe(true);
        expect(
            (
                (await (await imported(first, { ...valid, approvedDuplicates: approved })).json()) as {
                    imported: boolean;
                }
            ).imported,
        ).toBe(false);
        const chargeFile = {
            kind: 'charges',
            csv: 'date,label,type,amount\n2026-03-01,Travaux,Exceptionnel,20.00\n2026-03-01,Travaux,Exceptionnel,20.00',
            commit: false,
            approvedDuplicates: [],
        };
        const filePreview = (await (await imported(first, chargeFile)).json()) as {
            duplicates: { row: number; marker: string }[];
        };
        expect(filePreview.duplicates).toHaveLength(1);
        expect(filePreview.duplicates[0].row).toBe(3);
        expect(
            ((await (await imported(first, { ...chargeFile, commit: true })).json()) as { imported: boolean }).imported,
        ).toBe(false);
        expect(
            (
                (await (
                    await imported(first, {
                        ...chargeFile,
                        commit: true,
                        approvedDuplicates: filePreview.duplicates.map(item => item.marker),
                    })
                ).json()) as { imported: boolean }
            ).imported,
        ).toBe(true);
        const paymentFile = {
            kind: 'payments',
            csv: 'date,type,amount\n2026-03-02,Cheque,20.00',
            commit: true,
            approvedDuplicates: [],
        };
        expect(((await (await imported(first, paymentFile)).json()) as { imported: boolean }).imported).toBe(true);
        const invalid = { ...valid, csv: `${csv}\n2026-02-01;Erreur;X;1;1` };
        expect(((await (await imported(first, invalid)).json()) as { errors: unknown[] }).errors).toHaveLength(1);
        expect(store.sqlite.prepare('SELECT count(*) AS n FROM charges').get()).toEqual({ n: 4 });
        const edit = await request(
            `/api/payments/${payments[0].id}`,
            'PUT',
            { date: '2026-01-02', category: 'Chèque', amount: 1000 },
            first,
        );
        expect(edit.status).toBe(200);
        const edited = (await (await request('/api/payments', 'GET', undefined, first)).json()) as {
            id: string;
            label: string;
        }[];
        expect(edited.find(item => item.id === payments[0].id)?.label).toBe('Janvier');
    });

    it('ne conserve aucune ligne en cas de panne pendant la transaction', async () => {
        const store = openDatabase(':memory:');
        stores.push(store);
        const { app } = createApp(store, 'a-long-random-secret-for-testing-only-12345', origin);
        const signup = await app.request('/api/auth/sign-up/email', {
            method: 'POST',
            headers: { origin, 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Test', email: 'atomic@example.com', password: 'a-secure-password' }),
        });
        const cookie = signup.headers
            .getSetCookie()
            .map(value => value.split(';')[0])
            .join('; ');
        store.sqlite.exec(
            "CREATE TRIGGER fail_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT, 'test failure'); END",
        );
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await app.request('/api/import', {
            method: 'POST',
            headers: { origin, cookie, 'content-type': 'application/json' },
            body: JSON.stringify({
                kind: 'solde',
                csv: 'date;label;type;credit;debit\n2026-01-01;A;X;;1\n2026-01-02;B;Y;1;',
                commit: true,
                approvedDuplicates: [],
            }),
        });
        expect(result.status).toBe(500);
        expect(store.sqlite.prepare('SELECT count(*) AS n FROM charges').get()).toEqual({ n: 0 });
    });

    it('migre une base version 1 sans perdre les paiements', () => {
        const dir = mkdtempSync(join(tmpdir(), 'charges-import-test-'));
        try {
            const path = join(dir, 'test.sqlite');
            const original = openDatabase(path);
            original.sqlite
                .exec(`INSERT INTO "user" (id, name, email, createdAt, updatedAt) VALUES ('u', 'Test', 'migration@example.com', 0, 0);
                INSERT INTO payments (id, user_id, date, category, amount) VALUES ('p', 'u', '2026-01-01', 'Virement', 100);
                ALTER TABLE payments DROP COLUMN label; PRAGMA user_version = 1;`);
            original.sqlite.close();
            const migrated = openDatabase(path);
            expect(migrated.sqlite.pragma('user_version', { simple: true })).toBe(2);
            expect(migrated.sqlite.prepare('SELECT id, label FROM payments').get()).toEqual({ id: 'p', label: null });
            migrated.sqlite.close();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
