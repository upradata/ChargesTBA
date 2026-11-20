import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createApp } from './app';
import { openDatabase } from './db';
import type { ImportPreview, ImportProposal } from './import-preview';

const origin = 'http://127.0.0.1:5173';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => {
    for (const store of stores.splice(0)) if (store.sqlite.open) store.sqlite.close();
    vi.restoreAllMocks();
});

async function setup() {
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
        const cookie = result.headers
            .getSetCookie()
            .map(value => value.split(';')[0])
            .join('; ');
        await request('/api/settings', 'GET', undefined, cookie);
        return cookie;
    };
    const cookie = await signup('statement@example.com');
    const preview = async (csv: string, auth = cookie) => {
        const result = await request('/api/import', 'POST', { csv, commit: false, approvedDuplicates: [] }, auth);
        expect(result.status).toBe(200);
        return (await result.json()) as ImportPreview;
    };
    const commit = async (csv: string, previous: ImportPreview, proposals: ImportProposal[] = previous.proposals) => {
        const result = await request(
            '/api/import',
            'POST',
            {
                csv,
                commit: true,
                snapshot: previous.snapshot,
                approvedDuplicates: previous.duplicates.map(item => item.marker),
                proposals,
            },
            cookie,
        );
        return { result, body: (await result.json()) as ImportPreview };
    };
    return { store, request, signup, cookie, preview, commit };
}

const header = 'date;libellé;crédit;débit';
const category = 'Appel de fonds trimestriel';

describe('statement refunds and editable import allocations', () => {
    it('reserves refunds before cash and preserves the original principal', async () => {
        const { store, preview, commit } = await setup();
        const csv = `${header}\n2026-01-01;${category};;100\n2026-01-03;;100;\n2026-01-02;${category};;-25`;
        const before = await preview(csv);
        expect(before.errors).toEqual([]);
        expect(before.proposals).toEqual([
            { row: 4, allocations: [{ target: 'row:2', amount: 2500 }] },
            { row: 3, allocations: [{ target: 'row:2', amount: 7500 }] },
        ]);
        expect(store.sqlite.prepare('SELECT count(*) AS n FROM refunds').get()).toEqual({ n: 0 });
        expect((await commit(csv, before)).body.imported).toBe(true);
        expect(store.sqlite.prepare('SELECT amount FROM charges').get()).toEqual({ amount: 10000 });
        expect(store.sqlite.prepare('SELECT SUM(amount) AS n FROM allocations').get()).toEqual({ n: 7500 });
        expect(store.sqlite.prepare('SELECT SUM(amount) AS n FROM refund_applications').get()).toEqual({ n: 2500 });
        expect(store.sqlite.prepare('SELECT label, amount FROM payments').get()).toEqual({
            label: null,
            amount: 10000,
        });
        expect((await preview(csv)).duplicates).toHaveLength(3);
    });

    it('allows another charge or no allocation and keeps unapplied category credit', async () => {
        const { store, preview, commit } = await setup();
        const csv = `${header}\n2026-01-01;${category};;10\n2026-01-02;${category};;20\n2026-01-03;${category};;-40\n2026-01-04;;50;`;
        const before = await preview(csv);
        const proposals = before.proposals.map(item => ({
            ...item,
            allocations: item.row === 4 ? [{ target: 'row:3', amount: 1500 }] : [],
        }));
        expect((await commit(csv, before, proposals)).body.imported).toBe(true);
        expect(store.sqlite.prepare('SELECT SUM(amount) AS n FROM refund_applications').get()).toEqual({ n: 1500 });
        expect(store.sqlite.prepare('SELECT count(*) AS n FROM allocations').get()).toEqual({ n: 0 });
        expect(store.sqlite.prepare('SELECT amount FROM refunds').get()).toEqual({ amount: 4000 });
    });

    it('rejects invalid, duplicated, foreign or future targets while retaining edits', async () => {
        const { preview, commit } = await setup();
        const csv = `${header}\n2026-01-01;${category};;10\n2026-01-02;;20;`;
        const before = await preview(csv);
        for (const allocations of [
            [{ target: 'row:2', amount: 1001 }],
            [{ target: 'charge:other-account', amount: 10 }],
            [
                { target: 'row:2', amount: 10 },
                { target: 'row:2', amount: 10 },
            ],
        ]) {
            const proposed = [{ row: 3, allocations }];
            const after = await commit(csv, before, proposed);
            expect(after.body.imported).toBe(false);
            expect(after.body.errors[0].column).toBe('répartition');
            expect(after.body.proposals).toEqual(proposed);
        }
        const future = `${header}\n2026-01-03;${category};;10\n2026-01-02;;20;`;
        const futurePreview = await preview(future);
        expect(
            (await commit(future, futurePreview, [{ row: 3, allocations: [{ target: 'row:2', amount: 10 }] }])).body
                .errors.length,
        ).toBeGreaterThan(0);
    });

    it('requires a current snapshot and account-owned categories and rechecks duplicates', async () => {
        const { store, request, signup, cookie, preview, commit } = await setup();
        const other = await signup('other-statement@example.com');
        const csv = `${header}\n2026-01-01;${category};;10\n2026-01-02;;5;`;
        const before = await preview(csv);
        const noSnapshot = await request('/api/import', 'POST', { csv, commit: true, approvedDuplicates: [] }, cookie);
        expect(((await noSnapshot.json()) as ImportPreview).imported).toBe(false);
        expect((await commit(csv, before)).body.imported).toBe(true);
        expect((await commit(csv, before)).body.imported).toBe(false);
        expect((await preview(csv, other)).duplicates).toEqual([]);
        const duplicate = await preview(csv);
        expect(duplicate.duplicates).toHaveLength(2);
        expect((await commit(csv, duplicate)).body.imported).toBe(true);
        const stale = await preview(csv);
        store.sqlite.prepare('UPDATE categories SET name = ? WHERE name = ?').run('Autre catégorie', category);
        const staleCommit = (await commit(csv, stale)).body;
        expect(staleCommit.imported).toBe(false);
        expect(staleCommit.unresolvedCategories).toEqual([]);
        expect(staleCommit.rows[0].category).toBe('Autre catégorie');
    });

    it('does not save any imported movement or application if a later insertion fails', async () => {
        const { store, preview, commit } = await setup();
        const csv = `${header}\n2026-01-01;${category};;10\n2026-01-02;${category};;-1\n2026-01-03;;5;`;
        const before = await preview(csv);
        store.sqlite.exec(
            "CREATE TRIGGER fail_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT, 'test failure'); END",
        );
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect((await commit(csv, before)).result.status).toBe(500);
        for (const table of ['charges', 'payments', 'refunds', 'refund_applications', 'allocations'])
            expect(store.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    });
});
