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
        const csv = 'date;label;credit;debit\n2026-01-01;Appel de fonds trimestriel;;10,00\n2025-12-31;Janvier;10,00;';
        const body = { kind: 'solde', csv, commit: false, approvedDuplicates: [] };
        const imported = (cookie: string, payload: unknown) => request('/api/import', 'POST', payload, cookie);
        expect((await request('/api/import', 'POST', body)).status).toBe(401);
        const oversized = await request('/api/import', 'POST', { ...body, csv: 'x'.repeat(6_500_001) }, first);
        expect(oversized.status).toBe(413);
        const preview = (await (await imported(first, body)).json()) as {
            rows: unknown[];
            duplicates: { marker: string }[];
            imported: boolean;
            snapshot: string;
            proposals: { row: number; allocations: { target: string; amount: number }[] }[];
        };
        expect(preview.rows).toHaveLength(2);
        expect(preview.duplicates).toHaveLength(0);
        expect(store.sqlite.prepare('SELECT count(*) AS n FROM charges').get()).toEqual({ n: 0 });
        const valid = { ...body, commit: true, snapshot: preview.snapshot, proposals: preview.proposals };
        expect(((await (await imported(first, valid)).json()) as { imported: boolean }).imported).toBe(true);
        const importedCharges = (await (await request('/api/charges', 'GET', undefined, first)).json()) as {
            schedule: { date: string; amount: number }[];
        }[];
        expect(importedCharges[0].schedule).toEqual([{ date: '2026-01-01', amount: 1000 }]);
        const settings = (await (await request('/api/settings', 'GET', undefined, first)).json()) as {
            categories: { name: string }[];
        };
        expect(settings.categories.map(category => category.name)).toContain('Appel de fonds trimestriel');
        const payments = (await (await request('/api/payments', 'GET', undefined, first)).json()) as {
            id: string;
            label: string;
            allocated: number;
        }[];
        expect(payments[0]).toMatchObject({ label: 'Janvier', allocated: 0 });
        expect(await (await request('/api/payments', 'GET', undefined, second)).json()).toEqual([]);
        const duplicate = (await (await imported(first, body)).json()) as {
            duplicates: { marker: string }[];
            snapshot: string;
            proposals: { row: number; allocations: { target: string; amount: number }[] }[];
        };
        expect(duplicate.duplicates).toHaveLength(2);
        expect(((await (await imported(second, body)).json()) as { duplicates: unknown[] }).duplicates).toHaveLength(0);
        const validDuplicate = {
            ...valid,
            snapshot: duplicate.snapshot,
            proposals: duplicate.proposals,
        };
        expect(((await (await imported(first, validDuplicate)).json()) as { imported: boolean }).imported).toBe(false);
        const approved = duplicate.duplicates.map(item => item.marker);
        expect(
            (
                (await (await imported(first, { ...validDuplicate, approvedDuplicates: approved })).json()) as {
                    imported: boolean;
                }
            ).imported,
        ).toBe(true);
        expect(
            (
                (await (await imported(first, { ...validDuplicate, approvedDuplicates: approved })).json()) as {
                    imported: boolean;
                }
            ).imported,
        ).toBe(false);
        const chargeFile = {
            kind: 'charges',
            csv: 'date;label;credit;debit\n2026-03-01;Appel de fonds trimestriel;;20,00\n2026-03-01;Appel de fonds trimestriel;;20,00',
            commit: false,
            approvedDuplicates: [],
        };
        const filePreview = (await (await imported(first, chargeFile)).json()) as {
            duplicates: { row: number; marker: string }[];
            snapshot: string;
            proposals: { row: number; allocations: { target: string; amount: number }[] }[];
        };
        expect(filePreview.duplicates).toHaveLength(1);
        expect(filePreview.duplicates[0].row).toBe(3);
        expect(
            (
                (await (
                    await imported(first, {
                        ...chargeFile,
                        commit: true,
                        snapshot: filePreview.snapshot,
                        proposals: filePreview.proposals,
                    })
                ).json()) as { imported: boolean }
            ).imported,
        ).toBe(false);
        expect(
            (
                (await (
                    await imported(first, {
                        ...chargeFile,
                        commit: true,
                        approvedDuplicates: filePreview.duplicates.map(item => item.marker),
                        snapshot: filePreview.snapshot,
                        proposals: filePreview.proposals,
                    })
                ).json()) as { imported: boolean }
            ).imported,
        ).toBe(true);
        const paymentFile = {
            kind: 'payments',
            csv: 'date;label;credit;debit\n2026-03-02;Cheque;20,00;',
            commit: false,
            approvedDuplicates: [],
        };
        const paymentPreview = (await (await imported(first, paymentFile)).json()) as {
            snapshot: string;
            proposals: { row: number; allocations: { target: string; amount: number }[] }[];
        };
        expect(
            (
                (await (
                    await imported(first, {
                        ...paymentFile,
                        commit: true,
                        snapshot: paymentPreview.snapshot,
                        proposals: paymentPreview.proposals,
                    })
                ).json()) as { imported: boolean }
            ).imported,
        ).toBe(true);
        const invalid = { ...valid, csv: `${csv}\n2026-02-01;Erreur;1;1` };
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

    it('résout les libellés, puis crée une catégorie seulement à la confirmation', async () => {
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
        const cookie = await signup('category-import@example.com');
        const otherCookie = await signup('other-category@example.com');
        const ownSettings = (await (await request('/api/settings', 'GET', undefined, cookie)).json()) as {
            categories: { id: string; name: string }[];
        };
        const otherSettings = (await (await request('/api/settings', 'GET', undefined, otherCookie)).json()) as {
            categories: { id: string }[];
        };
        const csv = 'date;label;credit;debit\n2026-01-01;Travaux;;10,00\n2026-01-02;Travaux;;-2,00';
        const body = { csv, commit: false, approvedDuplicates: [] };
        const unresolvedPreview = (await (await request('/api/import', 'POST', body, cookie)).json()) as {
            errors: unknown[];
            unresolvedCategories: { label: string; rows: number[] }[];
            snapshot: string;
        };
        expect(unresolvedPreview.errors).toEqual([]);
        expect(unresolvedPreview.unresolvedCategories).toEqual([{ label: 'Travaux', rows: [2, 3] }]);
        const unresolvedCommit = (await (
            await request(
                '/api/import',
                'POST',
                {
                    ...body,
                    commit: true,
                    snapshot: unresolvedPreview.snapshot,
                    proposals: [],
                },
                cookie,
            )
        ).json()) as { imported: boolean };
        expect(unresolvedCommit.imported).toBe(false);
        const mappedPreview = (await (
            await request(
                '/api/import',
                'POST',
                {
                    ...body,
                    categoryResolutions: [
                        { label: 'Travaux', kind: 'existing', categoryId: ownSettings.categories[0].id },
                    ],
                },
                cookie,
            )
        ).json()) as {
            rows: { category: string }[];
            errors: unknown[];
            unresolvedCategories: unknown[];
        };
        expect(mappedPreview.errors).toEqual([]);
        expect(mappedPreview.unresolvedCategories).toEqual([]);
        expect(mappedPreview.rows.map(row => row.category)).toEqual([
            ownSettings.categories[0].name,
            ownSettings.categories[0].name,
        ]);
        const foreignCategory = (await (
            await request(
                '/api/import',
                'POST',
                {
                    ...body,
                    categoryResolutions: [
                        { label: 'Travaux', kind: 'existing', categoryId: otherSettings.categories[0].id },
                    ],
                },
                cookie,
            )
        ).json()) as { errors: { message: string }[]; unresolvedCategories: { label: string }[] };
        expect(foreignCategory.errors[0].message).toBe('Catégorie introuvable.');
        expect(foreignCategory.unresolvedCategories).toEqual([{ label: 'Travaux', rows: [2, 3] }]);

        const categoryResolutions = [
            { label: 'Travaux', kind: 'new', name: 'Travaux communs', defaultScheduleId: null },
        ];
        const preview = (await (
            await request('/api/import', 'POST', { ...body, categoryResolutions }, cookie)
        ).json()) as {
            rows: { category: string }[];
            errors: unknown[];
            unresolvedCategories: unknown[];
            snapshot: string;
            proposals: { row: number; allocations: { target: string; amount: number }[] }[];
        };
        expect(preview.errors).toEqual([]);
        expect(preview.unresolvedCategories).toEqual([]);
        expect(preview.rows.map(row => row.category)).toEqual(['Travaux communs', 'Travaux communs']);
        expect(
            store.sqlite.prepare('SELECT count(*) AS n FROM categories WHERE name = ?').get('Travaux communs'),
        ).toEqual({
            n: 0,
        });

        const changedResolution = (await (
            await request(
                '/api/import',
                'POST',
                {
                    ...body,
                    commit: true,
                    categoryResolutions: [
                        { label: 'Travaux', kind: 'new', name: 'Travaux alternatifs', defaultScheduleId: null },
                    ],
                    snapshot: preview.snapshot,
                    proposals: preview.proposals,
                },
                cookie,
            )
        ).json()) as { imported: boolean };
        expect(changedResolution.imported).toBe(false);
        expect(
            store.sqlite.prepare('SELECT count(*) AS n FROM categories WHERE name = ?').get('Travaux alternatifs'),
        ).toEqual({
            n: 0,
        });

        const committed = (await (
            await request(
                '/api/import',
                'POST',
                {
                    ...body,
                    commit: true,
                    categoryResolutions,
                    snapshot: preview.snapshot,
                    proposals: preview.proposals,
                },
                cookie,
            )
        ).json()) as { imported: boolean };
        expect(committed.imported).toBe(true);
        const category = store.sqlite.prepare('SELECT id FROM categories WHERE name = ?').get('Travaux communs') as {
            id: string;
        };
        expect(store.sqlite.prepare('SELECT category_id AS categoryId FROM refunds').get()).toEqual({
            categoryId: category.id,
        });
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
        const categoryResolutions = [{ label: 'A', kind: 'new', name: 'Nouvelle catégorie', defaultScheduleId: null }];
        const headers = { origin, cookie, 'content-type': 'application/json' };
        const previewResponse = await app.request('/api/import', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                csv: 'date;label;credit;debit\n2026-01-01;A;;1,00\n2026-01-02;B;1,00;',
                commit: false,
                approvedDuplicates: [],
                categoryResolutions,
            }),
        });
        const preview = (await previewResponse.json()) as {
            snapshot: string;
            proposals: { row: number; allocations: { target: string; amount: number }[] }[];
        };
        store.sqlite.exec(
            "CREATE TRIGGER fail_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT, 'test failure'); END",
        );
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await app.request('/api/import', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                csv: 'date;label;credit;debit\n2026-01-01;A;;1,00\n2026-01-02;B;1,00;',
                commit: true,
                approvedDuplicates: [],
                categoryResolutions,
                snapshot: preview.snapshot,
                proposals: preview.proposals,
            }),
        });
        expect(result.status).toBe(500);
        expect(store.sqlite.prepare('SELECT count(*) AS n FROM charges').get()).toEqual({ n: 0 });
        expect(
            store.sqlite.prepare('SELECT count(*) AS n FROM categories WHERE name = ?').get('Nouvelle catégorie'),
        ).toEqual({
            n: 0,
        });
    });

    it('migre une base version 1 sans perdre les paiements', () => {
        const dir = mkdtempSync(join(tmpdir(), 'charges-import-test-'));
        try {
            const path = join(dir, 'test.sqlite');
            const original = openDatabase(path);
            original.sqlite
                .exec(`INSERT INTO "user" (id, name, email, createdAt, updatedAt) VALUES ('u', 'Test', 'migration@example.com', 0, 0);
                INSERT INTO payments (id, user_id, date, category, amount) VALUES ('p', 'u', '2026-01-01', 'Virement', 100);
                DROP TABLE csv_mapping_rules; DROP TABLE payment_types; DROP TABLE csv_mappings_initialized;
                DROP TABLE refund_applications; DROP TABLE refunds;
                ALTER TABLE payments DROP COLUMN label; PRAGMA user_version = 1;`);
            original.sqlite.close();
            const migrated = openDatabase(path);
            expect(migrated.sqlite.pragma('user_version', { simple: true })).toBe(5);
            expect(migrated.sqlite.prepare('SELECT id, label FROM payments').get()).toEqual({ id: 'p', label: null });
            migrated.sqlite.close();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
