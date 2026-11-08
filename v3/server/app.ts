import { createHash, randomUUID } from 'node:crypto';

import { zValidator } from '@hono/zod-validator';
import { betterAuth } from 'better-auth';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { z } from 'zod';

import { addMonths } from '../shared/schedule';

import { allocations, charges, payments, type openDatabase } from './db';
import { MAX_CSV_BYTES, parseImport, type ImportRow } from './import-csv';

type Store = ReturnType<typeof openDatabase>;
const date = z.iso.date().refine(value => {
    try {
        addMonths(value, 0);
        return true;
    } catch {
        return false;
    }
}, 'Date invalide');
const amount = z.number().int().positive().max(100_000_000);
const chargeInput = z
    .object({
        title: z.string().trim().min(1).max(120),
        category: z.string().trim().min(1).max(80),
        date,
        amount,
        installments: z.number().int().min(1).max(120),
    })
    .refine(value => value.installments <= value.amount, 'Trop d’échéances pour le montant');
const paymentEditInput = z.object({
    date,
    category: z.string().trim().min(1).max(80),
    amount,
    label: z.string().trim().max(120).nullable().optional(),
});
const paymentInput = paymentEditInput
    .extend({
        allocations: z.array(z.object({ chargeId: z.uuid(), amount })).max(100),
    })
    .refine(
        value => value.allocations.reduce((sum, item) => sum + item.amount, 0) <= value.amount,
        'La répartition dépasse le paiement',
    );
const allocationInput = z.object({
    allocations: z
        .array(z.object({ chargeId: z.uuid(), amount }))
        .min(1)
        .max(100),
});
const importInput = z.object({
    kind: z.enum(['charges', 'payments', 'solde']),
    csv: z.string().max(MAX_CSV_BYTES),
    commit: z.boolean(),
    approvedDuplicates: z.array(z.string().max(100)).max(2000),
});

function importKey(row: ImportRow) {
    return JSON.stringify(
        row.kind === 'charge'
            ? [row.kind, row.date, row.title, row.category, row.amount]
            : [row.kind, row.date, row.category, row.amount, row.label || null],
    );
}

function findDuplicates(store: Store, userId: string, rows: ImportRow[]) {
    const existing = new Map<string, string[]>();
    for (const charge of store.db.select().from(charges).where(eq(charges.userId, userId)).all()) {
        const key = importKey({ ...charge, row: 0, kind: 'charge' });
        existing.set(key, [...(existing.get(key) ?? []), charge.id]);
    }
    for (const payment of store.db.select().from(payments).where(eq(payments.userId, userId)).all()) {
        const key = importKey({ ...payment, row: 0, kind: 'payment' });
        existing.set(key, [...(existing.get(key) ?? []), payment.id]);
    }
    const seen = new Map<string, number>();
    const duplicates: { row: number; marker: string }[] = [];
    for (const row of rows) {
        const key = importKey(row);
        const matches = existing.get(key);
        if (matches?.length) {
            const digest = createHash('sha256').update(matches.sort().join(',')).digest('hex');
            duplicates.push({ row: row.row, marker: `${row.row}:existing:${digest}` });
        }
        const previous = seen.get(key);
        if (previous !== undefined) duplicates.push({ row: row.row, marker: `${row.row}:file:${previous}` });
        else seen.set(key, row.row);
    }
    return duplicates;
}

function canAllocate(store: Store, userId: string, requested: { chargeId: string; amount: number }[]) {
    const totals = new Map<string, number>();
    for (const item of requested) totals.set(item.chargeId, (totals.get(item.chargeId) ?? 0) + item.amount);
    for (const [chargeId, allocated] of totals) {
        const charge = store.db
            .select()
            .from(charges)
            .where(and(eq(charges.id, chargeId), eq(charges.userId, userId)))
            .get();
        if (!charge) return false;
        const paid = store.db
            .select()
            .from(allocations)
            .where(eq(allocations.chargeId, chargeId))
            .all()
            .reduce((sum, item) => sum + item.amount, 0);
        if (paid + allocated > charge.amount) return false;
    }
    return true;
}

function insertAllocations(store: Store, paymentId: string, requested: { chargeId: string; amount: number }[]) {
    for (const item of requested)
        store.db
            .insert(allocations)
            .values({
                id: randomUUID(),
                paymentId,
                chargeId: item.chargeId,
                amount: item.amount,
            })
            .run();
}

export function createApp(store: Store, secret: string, origin: string) {
    const auth = betterAuth({
        database: store.sqlite,
        secret,
        baseURL: origin,
        emailAndPassword: { enabled: true },
        trustedOrigins: [origin],
    });
    const app = new Hono();
    app.use('/api/*', async (c, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('origin') !== origin) {
            return c.json({ error: 'Origine non autorisée' }, 403);
        }
        await next();
    });
    app.use('/api/*', csrf({ origin }));
    app.use(
        '/api/import',
        bodyLimit({
            maxSize: 6_500_000,
            onError: c => c.json({ error: 'Requête d’import trop volumineuse.' }, 413),
        }),
    );
    app.on(['POST', 'GET'], '/api/auth/*', c => auth.handler(c.req.raw));
    const api = app
        .post('/api/import', zValidator('json', importInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const { kind, csv, commit, approvedDuplicates } = c.req.valid('json');
            const parsed = parseImport(kind, csv);
            if (parsed.errors.length) return c.json({ ...parsed, duplicates: [], imported: false }, 200);
            try {
                const result = store.sqlite.transaction(() => {
                    const duplicates = findDuplicates(store, session.user.id, parsed.rows);
                    if (!commit || duplicates.some(item => !approvedDuplicates.includes(item.marker))) {
                        return { ...parsed, duplicates, imported: false };
                    }
                    for (const row of parsed.rows) {
                        if (row.kind === 'charge') {
                            const { row: _row, kind: _kind, ...data } = row;
                            store.db
                                .insert(charges)
                                .values({
                                    ...data,
                                    id: randomUUID(),
                                    userId: session.user.id,
                                    installments: 1,
                                })
                                .run();
                        } else {
                            const { row: _row, kind: _kind, ...data } = row;
                            store.db
                                .insert(payments)
                                .values({ ...data, id: randomUUID(), userId: session.user.id })
                                .run();
                        }
                    }
                    return { ...parsed, duplicates, imported: true };
                })();
                return c.json(result);
            } catch {
                console.error('Échec de la transaction d’import CSV.');
                return c.json({ error: 'Import impossible. Aucune ligne n’a été enregistrée.' }, 500);
            }
        })
        .get('/api/charges', async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const rows = store.db.select().from(charges).where(eq(charges.userId, session.user.id)).all();
            const ids = rows.map(row => row.id);
            const applied = ids.length
                ? store.db.select().from(allocations).where(inArray(allocations.chargeId, ids)).all()
                : [];
            return c.json(
                rows.map(row => ({
                    ...row,
                    paid: applied.filter(item => item.chargeId === row.id).reduce((sum, item) => sum + item.amount, 0),
                })),
            );
        })
        .post('/api/charges', zValidator('json', chargeInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const row = { ...c.req.valid('json'), id: randomUUID(), userId: session.user.id };
            store.db.insert(charges).values(row).run();
            return c.json(row, 201);
        })
        .put('/api/charges/:id', zValidator('json', chargeInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const result = store.sqlite.transaction(() => {
                const charge = store.db
                    .select()
                    .from(charges)
                    .where(and(eq(charges.id, c.req.param('id')), eq(charges.userId, session.user.id)))
                    .get();
                if (!charge) return false;
                const paid = store.db
                    .select()
                    .from(allocations)
                    .where(eq(allocations.chargeId, charge.id))
                    .all()
                    .reduce((sum, item) => sum + item.amount, 0);
                const data = c.req.valid('json');
                if (data.amount < paid) return false;
                store.db.update(charges).set(data).where(eq(charges.id, charge.id)).run();
                return true;
            })();
            if (!result)
                return c.json({ error: 'Charge introuvable ou montant inférieur aux paiements affectés' }, 400);
            return c.json({ success: true });
        })
        .get('/api/payments', async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const rows = store.db.select().from(payments).where(eq(payments.userId, session.user.id)).all();
            const ids = rows.map(row => row.id);
            const applied = ids.length
                ? store.db.select().from(allocations).where(inArray(allocations.paymentId, ids)).all()
                : [];
            return c.json(
                rows.map(row => ({
                    ...row,
                    allocated: applied
                        .filter(item => item.paymentId === row.id)
                        .reduce((sum, item) => sum + item.amount, 0),
                })),
            );
        })
        .post('/api/payments', zValidator('json', paymentInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const { allocations: requested, ...data } = c.req.valid('json');
            const id = randomUUID();
            const result = store.sqlite.transaction(() => {
                if (!canAllocate(store, session.user.id, requested)) return false;
                store.db
                    .insert(payments)
                    .values({ ...data, id, userId: session.user.id })
                    .run();
                insertAllocations(store, id, requested);
                return true;
            })();
            if (!result) return c.json({ error: 'Charge introuvable ou montant supérieur au reste dû' }, 400);
            return c.json({ id }, 201);
        })
        .put('/api/payments/:id', zValidator('json', paymentEditInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const result = store.sqlite.transaction(() => {
                const payment = store.db
                    .select()
                    .from(payments)
                    .where(and(eq(payments.id, c.req.param('id')), eq(payments.userId, session.user.id)))
                    .get();
                if (!payment) return false;
                const allocated = store.db
                    .select()
                    .from(allocations)
                    .where(eq(allocations.paymentId, payment.id))
                    .all()
                    .reduce((sum, item) => sum + item.amount, 0);
                const data = c.req.valid('json');
                if (data.amount < allocated) return false;
                store.db.update(payments).set(data).where(eq(payments.id, payment.id)).run();
                return true;
            })();
            if (!result)
                return c.json({ error: 'Paiement introuvable ou montant inférieur aux sommes affectées' }, 400);
            return c.json({ success: true });
        })
        .post('/api/payments/:id/allocations', zValidator('json', allocationInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const requested = c.req.valid('json').allocations;
            const result = store.sqlite.transaction(() => {
                const payment = store.db
                    .select()
                    .from(payments)
                    .where(and(eq(payments.id, c.req.param('id')), eq(payments.userId, session.user.id)))
                    .get();
                if (!payment) return false;
                const already = store.db
                    .select()
                    .from(allocations)
                    .where(eq(allocations.paymentId, payment.id))
                    .all()
                    .reduce((sum, item) => sum + item.amount, 0);
                if (
                    already + requested.reduce((sum, item) => sum + item.amount, 0) > payment.amount
                    || !canAllocate(store, session.user.id, requested)
                )
                    return false;
                insertAllocations(store, payment.id, requested);
                return true;
            })();
            if (!result) return c.json({ error: 'Crédit insuffisant ou charge invalide' }, 400);
            return c.json({ success: true });
        });
    app.onError((error, c) => {
        console.error('Erreur serveur', error);
        return c.json({ error: 'Erreur interne du serveur' }, 500);
    });
    return { app, api, auth };
}

export type AppType = ReturnType<typeof createApp>['api'];
