import { randomUUID } from 'node:crypto';

import { zValidator } from '@hono/zod-validator';
import { betterAuth } from 'better-auth';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { z } from 'zod';

import { addMonths, splitCents, type Installment, type ScheduleRule } from '../shared/schedule';

import { allocations, charges, payments, type openDatabase } from './db';
import { MAX_CSV_BYTES } from './import-csv';
import { commitImport, previewImport, validateProposals } from './import-preview';

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
const rulesSchema = z
    .array(
        z.object({
            monthOffset: z.number().int().min(0).max(120),
            day: z.number().int().min(1).max(31),
            weight: z.number().int().min(1).max(10000),
        }),
    )
    .min(1)
    .max(120);
const templateInput = z.object({ name: z.string().trim().min(1).max(80), rules: rulesSchema });
const categoryInput = z.object({
    name: z.string().trim().min(1).max(80),
    defaultScheduleId: z.uuid().nullable(),
});
const chargeInput = z
    .object({
        title: z.string().trim().min(1).max(120),
        category: z.string().trim().min(1).max(80),
        date,
        amount,
        installments: z.number().int().min(1).max(120),
        schedule: z.array(z.object({ date, amount })).min(1).max(120).optional(),
    })
    .refine(value => value.installments <= value.amount, 'Trop d’échéances pour le montant')
    .refine(
        value =>
            !value.schedule
            || (value.schedule.length === value.installments
                && value.schedule.reduce((sum, item) => sum + item.amount, 0) === value.amount),
        'Le total des échéances doit correspondre au montant de la charge',
    );
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
    csv: z.string().max(MAX_CSV_BYTES),
    commit: z.boolean(),
    approvedDuplicates: z.array(z.string().max(100)).max(2000),
    snapshot: z.string().length(64).optional(),
    proposals: z
        .array(
            z.object({
                row: z.number().int().positive(),
                allocations: z.array(z.object({ target: z.string().max(100), amount })).max(1000),
            }),
        )
        .max(1000)
        .optional(),
});

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
        const refunded = store.sqlite
            .prepare(
                `SELECT COALESCE(SUM(ra.amount), 0) AS amount
                 FROM refund_applications ra
                 JOIN charges c ON c.id = ra.charge_id
                 WHERE ra.charge_id = ? AND c.user_id = ?`,
            )
            .get(chargeId, userId) as { amount: number };
        if (paid + refunded.amount + allocated > charge.amount) return false;
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

function initializeSettings(store: Store, userId: string) {
    store.sqlite.transaction(() => {
        if (store.sqlite.prepare('SELECT 1 FROM settings_initialized WHERE user_id = ?').get(userId)) return;
        const templateId = randomUUID();
        const rules = [1, 2, 3].map(monthOffset => ({ monthOffset, day: 1, weight: 1 }));
        store.sqlite
            .prepare('INSERT INTO schedule_templates VALUES (?, ?, ?, ?)')
            .run(templateId, userId, 'Trois mensualités (1er du mois)', JSON.stringify(rules));
        const insert = store.sqlite.prepare('INSERT OR IGNORE INTO categories VALUES (?, ?, ?, NULL)');
        for (const name of ['Appel de fonds trimestriel', 'Appel fonds de réserve trvx']) {
            insert.run(randomUUID(), userId, name);
        }
        const existing = store.sqlite
            .prepare('SELECT DISTINCT category FROM charges WHERE user_id = ?')
            .all(userId) as { category: string }[];
        for (const row of existing) insert.run(randomUUID(), userId, row.category);
        store.sqlite.prepare('INSERT INTO settings_initialized VALUES (?)').run(userId);
    })();
}

function saveSchedule(store: Store, chargeId: string, schedule: Installment[]) {
    store.sqlite.prepare('DELETE FROM charge_installments WHERE charge_id = ?').run(chargeId);
    const insert = store.sqlite.prepare('INSERT INTO charge_installments VALUES (?, ?, ?, ?)');
    [...schedule]
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((item, index) => insert.run(chargeId, index, item.date, item.amount));
}

function legacySchedule(data: { date: string; amount: number; installments: number }) {
    return splitCents(data.amount, data.installments).map((part, index) => ({
        date: addMonths(data.date, index),
        amount: part,
    }));
}

type TemplateRow = { id: string; name: string; rules: string };
type CategoryRow = { id: string; name: string; defaultScheduleId: string | null };

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
        .get('/api/settings', async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const userId = session.user.id;
            initializeSettings(store, userId);
            const categories = store.sqlite
                .prepare(
                    'SELECT id, name, default_schedule_id AS defaultScheduleId FROM categories WHERE user_id = ? ORDER BY name',
                )
                .all(userId) as CategoryRow[];
            const rows = store.sqlite
                .prepare('SELECT id, name, rules FROM schedule_templates WHERE user_id = ? ORDER BY name')
                .all(userId) as TemplateRow[];
            return c.json({
                categories,
                templates: rows.map(row => ({ ...row, rules: JSON.parse(row.rules) as ScheduleRule[] })),
            });
        })
        .post('/api/categories', zValidator('json', categoryInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            initializeSettings(store, session.user.id);
            const data = c.req.valid('json');
            if (
                data.defaultScheduleId
                && !store.sqlite
                    .prepare('SELECT 1 FROM schedule_templates WHERE id = ? AND user_id = ?')
                    .get(data.defaultScheduleId, session.user.id)
            )
                return c.json({ error: 'Échéancier introuvable' }, 400);
            if (
                store.sqlite
                    .prepare('SELECT 1 FROM categories WHERE user_id = ? AND name = ? COLLATE NOCASE')
                    .get(session.user.id, data.name)
            )
                return c.json({ error: 'Cette catégorie existe déjà' }, 400);
            const id = randomUUID();
            store.sqlite
                .prepare('INSERT INTO categories VALUES (?, ?, ?, ?)')
                .run(id, session.user.id, data.name, data.defaultScheduleId);
            return c.json({ id }, 201);
        })
        .put('/api/categories/:id', zValidator('json', categoryInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const data = c.req.valid('json');
            const userId = session.user.id;
            if (
                data.defaultScheduleId
                && !store.sqlite
                    .prepare('SELECT 1 FROM schedule_templates WHERE id = ? AND user_id = ?')
                    .get(data.defaultScheduleId, userId)
            )
                return c.json({ error: 'Échéancier introuvable' }, 400);
            if (
                store.sqlite
                    .prepare('SELECT 1 FROM categories WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ?')
                    .get(userId, data.name, c.req.param('id'))
            )
                return c.json({ error: 'Cette catégorie existe déjà' }, 400);
            const result = store.sqlite
                .prepare('UPDATE categories SET name = ?, default_schedule_id = ? WHERE id = ? AND user_id = ?')
                .run(data.name, data.defaultScheduleId, c.req.param('id'), userId);
            if (!result.changes) return c.json({ error: 'Catégorie introuvable' }, 404);
            return c.json({ success: true });
        })
        .delete('/api/categories/:id', async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            if (
                store.sqlite
                    .prepare(
                        `SELECT 1 FROM refunds r
                         JOIN categories c ON c.id = r.category_id
                         WHERE r.category_id = ? AND r.user_id = ? AND c.user_id = ?`,
                    )
                    .get(c.req.param('id'), session.user.id, session.user.id)
            )
                return c.json({ error: 'Cette catégorie est utilisée par un remboursement' }, 400);
            const result = store.sqlite
                .prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')
                .run(c.req.param('id'), session.user.id);
            if (!result.changes) return c.json({ error: 'Catégorie introuvable' }, 404);
            return c.json({ success: true });
        })
        .post('/api/templates', zValidator('json', templateInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            initializeSettings(store, session.user.id);
            const data = c.req.valid('json');
            if (
                store.sqlite
                    .prepare('SELECT 1 FROM schedule_templates WHERE user_id = ? AND name = ? COLLATE NOCASE')
                    .get(session.user.id, data.name)
            )
                return c.json({ error: 'Cet échéancier existe déjà' }, 400);
            const id = randomUUID();
            store.sqlite
                .prepare('INSERT INTO schedule_templates VALUES (?, ?, ?, ?)')
                .run(id, session.user.id, data.name, JSON.stringify(data.rules));
            return c.json({ id }, 201);
        })
        .put('/api/templates/:id', zValidator('json', templateInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const data = c.req.valid('json');
            if (
                store.sqlite
                    .prepare(
                        'SELECT 1 FROM schedule_templates WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ?',
                    )
                    .get(session.user.id, data.name, c.req.param('id'))
            )
                return c.json({ error: 'Cet échéancier existe déjà' }, 400);
            const result = store.sqlite
                .prepare('UPDATE schedule_templates SET name = ?, rules = ? WHERE id = ? AND user_id = ?')
                .run(data.name, JSON.stringify(data.rules), c.req.param('id'), session.user.id);
            if (!result.changes) return c.json({ error: 'Échéancier introuvable' }, 404);
            return c.json({ success: true });
        })
        .delete('/api/templates/:id', async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const result = store.sqlite
                .prepare('DELETE FROM schedule_templates WHERE id = ? AND user_id = ?')
                .run(c.req.param('id'), session.user.id);
            if (!result.changes) return c.json({ error: 'Échéancier introuvable' }, 404);
            return c.json({ success: true });
        })
        .post('/api/import', zValidator('json', importInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const { csv, commit, approvedDuplicates, snapshot, proposals } = c.req.valid('json');
            initializeSettings(store, session.user.id);
            try {
                const result = store.sqlite.transaction(() => {
                    const preview = previewImport(store, session.user.id, csv);
                    if (
                        !commit
                        || preview.errors.length
                        || snapshot !== preview.snapshot
                        || !proposals
                        || preview.duplicates.some(item => !approvedDuplicates.includes(item.marker))
                    )
                        return preview;
                    const errors = validateProposals(preview, proposals);
                    if (errors.length) return { ...preview, proposals, errors };
                    commitImport(store, session.user.id, preview, proposals);
                    return { ...preview, proposals, imported: true };
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
            const refunded = store.sqlite
                .prepare(
                    `SELECT ra.charge_id AS chargeId, SUM(ra.amount) AS amount
                     FROM refund_applications ra
                     JOIN charges c ON c.id = ra.charge_id
                     WHERE c.user_id = ?
                     GROUP BY ra.charge_id`,
                )
                .all(session.user.id) as { chargeId: string; amount: number }[];
            return c.json(
                rows.map(row => {
                    const paid = applied
                        .filter(item => item.chargeId === row.id)
                        .reduce((sum, item) => sum + item.amount, 0);
                    const refundedAmount = refunded.find(item => item.chargeId === row.id)?.amount ?? 0;
                    return {
                        ...row,
                        schedule: store.sqlite
                            .prepare(
                                'SELECT date, amount FROM charge_installments WHERE charge_id = ? ORDER BY position',
                            )
                            .all(row.id) as Installment[],
                        paid,
                        refunded: refundedAmount,
                        available: Math.max(0, row.amount - paid - refundedAmount),
                    };
                }),
            );
        })
        .post('/api/charges', zValidator('json', chargeInput), async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const { schedule, ...data } = c.req.valid('json');
            const row = { ...data, id: randomUUID(), userId: session.user.id };
            store.sqlite.transaction(() => {
                store.db.insert(charges).values(row).run();
                saveSchedule(store, row.id, schedule ?? legacySchedule(data));
            })();
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
                const refundData = store.sqlite
                    .prepare(
                        `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
                         FROM refund_applications WHERE charge_id = ?`,
                    )
                    .get(charge.id) as { count: number; amount: number };
                const { schedule, ...data } = c.req.valid('json');
                if (data.amount < paid + refundData.amount) return false;
                if (data.category !== charge.category && refundData.count > 0) return false;
                store.db.update(charges).set(data).where(eq(charges.id, charge.id)).run();
                saveSchedule(store, charge.id, schedule ?? legacySchedule(data));
                return true;
            })();
            if (!result)
                return c.json(
                    { error: 'Charge introuvable, montant inférieur aux sommes affectées ou catégorie déjà remboursée' },
                    400,
                );
            return c.json({ success: true });
        })
        .delete('/api/charges/:id', async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const result = store.sqlite.transaction(() => {
                const charge = store.db
                    .select()
                    .from(charges)
                    .where(and(eq(charges.id, c.req.param('id')), eq(charges.userId, session.user.id)))
                    .get();
                if (!charge) return 'missing' as const;
                const paid = store.sqlite
                    .prepare('SELECT 1 FROM allocations WHERE charge_id = ? LIMIT 1')
                    .get(charge.id);
                const refunded = store.sqlite
                    .prepare('SELECT 1 FROM refund_applications WHERE charge_id = ? LIMIT 1')
                    .get(charge.id);
                if (paid || refunded) return 'in-use' as const;
                store.db.delete(charges).where(eq(charges.id, charge.id)).run();
                return 'deleted' as const;
            })();
            if (result === 'missing') return c.json({ error: 'Charge introuvable' }, 404);
            if (result === 'in-use')
                return c.json({ error: 'Cette charge comporte des paiements ou remboursements affectés' }, 400);
            return c.json({ success: true });
        })
        .get('/api/refunds', async c => {
            const session = await auth.api.getSession({ headers: c.req.raw.headers });
            if (!session) return c.json({ error: 'Non authentifié' }, 401);
            const rows = store.sqlite
                .prepare(
                    `SELECT r.id, r.user_id AS userId, r.date, r.title, r.category_id AS categoryId,
                            c.name AS category, r.amount,
                            COALESCE(SUM(CASE WHEN target.id IS NOT NULL THEN ra.amount ELSE 0 END), 0) AS appliedAmount
                     FROM refunds r
                     JOIN categories c ON c.id = r.category_id AND c.user_id = r.user_id
                     LEFT JOIN refund_applications ra ON ra.refund_id = r.id
                     LEFT JOIN charges target ON target.id = ra.charge_id AND target.user_id = r.user_id
                     WHERE r.user_id = ?
                     GROUP BY r.id
                     ORDER BY r.date, r.id`,
                )
                .all(session.user.id) as {
                id: string;
                userId: string;
                date: string;
                title: string;
                categoryId: string;
                category: string;
                amount: number;
                appliedAmount: number;
            }[];
            const applications = store.sqlite
                .prepare(
                    `SELECT ra.id, ra.refund_id AS refundId, ra.charge_id AS chargeId, ra.amount
                     FROM refund_applications ra
                     JOIN refunds r ON r.id = ra.refund_id
                     JOIN charges c ON c.id = ra.charge_id AND c.user_id = r.user_id
                     WHERE r.user_id = ?
                     ORDER BY ra.id`,
                )
                .all(session.user.id) as { id: string; refundId: string; chargeId: string; amount: number }[];
            const byRefund = new Map<string, typeof applications>();
            for (const application of applications) {
                byRefund.set(application.refundId, [...(byRefund.get(application.refundId) ?? []), application]);
            }
            return c.json(
                rows.map(refund => ({
                    ...refund,
                    unappliedAmount: refund.amount - refund.appliedAmount,
                    applications: byRefund.get(refund.id) ?? [],
                })),
            );
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
