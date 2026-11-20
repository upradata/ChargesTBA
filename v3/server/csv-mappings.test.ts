import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createApp } from './app';
import { matchMappingRules } from './csv-mappings';
import { openDatabase } from './db';
import type { ImportPreview } from './import-preview';

const origin = 'http://127.0.0.1:5173';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => {
    for (const store of stores.splice(0)) if (store.sqlite.open) store.sqlite.close();
});

async function setup() {
    const store = openDatabase(':memory:');
    stores.push(store);
    const { app } = createApp(store, 'a-long-random-secret-for-testing-only-12345', origin);
    const request = (path: string, method = 'GET', body?: unknown, cookie?: string) =>
        app.request(path, {
            method,
            headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
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
        return cookie;
    };
    const cookie = await signup('mapping@example.com');
    const settings = async (auth = cookie) => {
        const response = await request('/api/settings', 'GET', undefined, auth);
        return (await response.json()) as {
            categories: { id: string; name: string }[];
            paymentTypes: { id: string; name: string }[];
            mappingRules: { id: string; pattern: string; categoryId: string | null; paymentTypeId: string | null }[];
        };
    };
    const preview = async (csv: string, resolutions: unknown[] = []) => {
        const response = await request(
            '/api/import',
            'POST',
            { csv, commit: false, approvedDuplicates: [], categoryResolutions: resolutions },
            cookie,
        );
        expect(response.status).toBe(200);
        return (await response.json()) as ImportPreview;
    };
    return { store, request, signup, cookie, settings, preview };
}

describe('CSV mapping rules', () => {
    it('initializes existing accounts once without replacing their categories', async () => {
        const { store, cookie, settings } = await setup();
        const user = store.sqlite.prepare('SELECT id FROM "user" WHERE email = ?').get('mapping@example.com') as {
            id: string;
        };
        store.sqlite.prepare('INSERT INTO settings_initialized VALUES (?)').run(user.id);
        store.sqlite
            .prepare('INSERT INTO categories VALUES (?, ?, ?, NULL)')
            .run('existing-category', user.id, 'Travaux toiture');
        const initialized = await settings(cookie);
        expect(initialized.categories.find(category => category.name === 'Travaux toiture')?.id).toBe(
            'existing-category',
        );
        expect(initialized.mappingRules.find(rule => rule.categoryId === 'existing-category')).toBeDefined();
        store.sqlite.prepare('DELETE FROM categories WHERE id = ?').run('existing-category');
        const afterDelete = await settings(cookie);
        expect(afterDelete.categories.some(category => category.name === 'Travaux toiture')).toBe(false);
        expect(afterDelete.mappingRules.some(rule => rule.categoryId === 'existing-category')).toBe(false);
    });

    it('seeds once and classifies charges and payments from the sample patterns', async () => {
        const { request, cookie, settings, preview } = await setup();
        const initial = await settings();
        expect(initial.paymentTypes.map(item => item.name)).toEqual(['Chèque', 'Prélèvement automatique', 'Virement']);
        const csv =
            'date;libellé;crédit;débit\n2026-01-01;4ie Ech TRX TOITURE;;10\n2026-01-02;Votre virement;10;\n2026-01-03;Autre paiement;1;\n2026-01-04;REMBOURSEMENT AVANCE TRESORERI;;-10\n2026-01-05;Régul. Appels de fonds 2025/2026;;-10';
        const result = await preview(csv);
        expect(result.rows.map(row => row.category)).toEqual([
            'Travaux toiture',
            'Virement',
            'Paiement importé',
            'Remboursement avance de trésorerie',
            'Régularisation appels de fonds',
        ]);
        const rule = initial.mappingRules.find(item => item.pattern === 'virement');
        expect(rule).toBeDefined();
        expect((await request(`/api/csv-rules/${rule!.id}`, 'DELETE', undefined, cookie)).status).toBe(200);
        expect((await settings()).mappingRules.some(item => item.id === rule!.id)).toBe(false);
        expect((await preview(csv)).rows[1].category).toBe('Paiement importé');
    });

    it('enforces ownership, ordering, overrides and category deletion cascades', async () => {
        const { request, signup, cookie, settings, preview } = await setup();
        const current = await settings();
        const other = await signup('other-mapping@example.com');
        const foreign = await settings(other);
        const roof = current.categories.find(item => item.name === 'Travaux toiture')!;
        const quarterly = current.categories.find(item => item.name === 'Appel de fonds trimestriel')!;
        const payment = current.paymentTypes.find(item => item.name === 'Chèque')!;
        expect(
            (
                await request(
                    '/api/csv-rules',
                    'POST',
                    { pattern: '(', ignoreCase: true, targetKind: 'charge', targetId: roof.id },
                    cookie,
                )
            ).status,
        ).toBe(400);
        expect(
            (
                await request(
                    '/api/csv-rules',
                    'POST',
                    { pattern: 'test', ignoreCase: true, targetKind: 'charge', targetId: foreign.categories[0].id },
                    cookie,
                )
            ).status,
        ).toBe(400);
        expect(
            (
                await request(
                    '/api/csv-rules',
                    'POST',
                    { pattern: 'toiture', ignoreCase: true, targetKind: 'charge', targetId: quarterly.id },
                    cookie,
                )
            ).status,
        ).toBe(201);
        const updated = await settings();
        const added = updated.mappingRules.find(item => item.pattern === 'toiture')!;
        const ids = [added.id, ...updated.mappingRules.filter(item => item.id !== added.id).map(item => item.id)];
        expect((await request('/api/csv-rules/order', 'PUT', { ids }, cookie)).status).toBe(200);
        const csv = 'date;libellé;crédit;débit\n2026-01-01;TRX TOITURE;;10\n2026-01-02;Votre virement;10;';
        expect((await preview(csv)).rows[0].category).toBe(quarterly.name);
        const overridden = await preview(csv, [
            { label: 'TRX TOITURE', kind: 'existing', categoryId: roof.id },
            { label: 'Votre virement', kind: 'existing', categoryId: payment.id, targetKind: 'payment' },
        ]);
        expect(overridden.errors).toEqual([]);
        expect(overridden.rows.map(row => row.category)).toEqual([roof.name, payment.name]);
        expect((await request(`/api/payment-types/${payment.id}`, 'DELETE', undefined, cookie)).status).toBe(200);
        expect((await settings()).mappingRules.some(item => item.paymentTypeId === payment.id)).toBe(false);
    });

    it('requires review again when mapping rules change after preview', async () => {
        const { request, cookie, settings, preview } = await setup();
        const current = await settings();
        const csv = 'date;libellé;crédit;débit\n2026-01-01;Votre virement;10;';
        const before = await preview(csv);
        const rule = current.mappingRules.find(item => item.pattern === 'virement')!;
        expect((await request(`/api/csv-rules/${rule.id}`, 'DELETE', undefined, cookie)).status).toBe(200);
        const response = await request(
            '/api/import',
            'POST',
            {
                csv,
                commit: true,
                approvedDuplicates: [],
                snapshot: before.snapshot,
                proposals: before.proposals,
            },
            cookie,
        );
        expect(response.status).toBe(200);
        const result = (await response.json()) as ImportPreview;
        expect(result.imported).toBe(false);
        expect(result.rows[0].category).toBe('Paiement importé');
    });

    it('terminates pathological JavaScript expressions instead of blocking the event loop', async () => {
        await expect(
            matchMappingRules(
                [
                    {
                        id: 'rule',
                        pattern: '(a+)+$',
                        ignoreCase: false,
                        position: 0,
                        categoryId: 'target',
                        paymentTypeId: null,
                    },
                ],
                [{ label: `${'a'.repeat(100)}!`, kind: 'charge' }],
            ),
        ).rejects.toThrow('temps autorisé');
    }, 5000);
});
