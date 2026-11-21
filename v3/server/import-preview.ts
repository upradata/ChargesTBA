import { createHash, randomUUID } from 'node:crypto';

import { getMappingRules, type MappingKind, type MappingMatch } from './csv-mappings';
import type { openDatabase } from './db';
import {
    categoryLabelKey,
    parseImport,
    pendingCategoryId,
    type ImportCategory,
    type ImportCategoryResolution,
    type ImportError,
    type ImportRow,
    type PendingRow,
} from './import-csv';

type Store = ReturnType<typeof openDatabase>;
export type ImportAllocation = { target: string; amount: number };
export type ImportProposal = { row: number; allocations: ImportAllocation[] };
export type ImportTarget = {
    key: string;
    date: string;
    title: string;
    category: string;
    remaining: number;
};
export type ImportPreview = {
    rows: ImportRow[];
    errors: ImportError[];
    unresolvedCategories: { label: string; rows: number[] }[];
    pendingRows: PendingRow[];
    categoryLabels: { label: string; rows: number[]; targetKind: MappingKind }[];
    duplicates: { row: number; marker: string }[];
    targets: ImportTarget[];
    proposals: ImportProposal[];
    snapshot: string;
    imported: boolean;
};

function digest(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function rowKey(row: ImportRow) {
    return row.kind === 'payment'
        ? JSON.stringify([row.kind, row.date, row.label, row.amount])
        : JSON.stringify([row.kind, row.date, row.title.trim().toLowerCase(), row.categoryId, row.amount]);
}

function validateCategoryResolutions(
    store: Store,
    userId: string,
    categories: ImportCategory[],
    paymentTypes: ImportCategory[],
    categoryLabels: ImportPreview['categoryLabels'],
    resolutions: ImportCategoryResolution[],
): ImportError[] {
    const errors: ImportError[] = [];
    const labels = new Map(categoryLabels.map(item => [`${item.targetKind}:${categoryLabelKey(item.label)}`, item]));
    const seenLabels = new Set<string>();
    const categoryNames = new Set(categories.map(item => categoryLabelKey(item.name)));
    for (const resolution of resolutions) {
        const targetKind = resolution.kind === 'existing' ? (resolution.targetKind ?? 'charge') : 'charge';
        const key = `${targetKind}:${categoryLabelKey(resolution.label)}`;
        const unresolved = labels.get(key);
        const row = unresolved?.rows[0] ?? 0;
        if (!unresolved) {
            errors.push({ row, column: 'catégorie', message: 'Ce libellé ne correspond à aucune ligne.' });
            continue;
        }
        if (seenLabels.has(key)) {
            errors.push({ row, column: 'catégorie', message: 'Plusieurs choix sont associés au même libellé.' });
            continue;
        }
        seenLabels.add(key);
        if (resolution.kind === 'existing') {
            if (!(targetKind === 'payment' ? paymentTypes : categories).some(item => item.id === resolution.categoryId))
                errors.push({ row, column: 'catégorie', message: 'Catégorie introuvable.' });
            continue;
        }
        const name = categoryLabelKey(resolution.name);
        if (categoryNames.has(name)) {
            errors.push({ row, column: 'catégorie', message: 'Cette catégorie existe déjà ou est déjà préparée.' });
        } else {
            categoryNames.add(name);
        }
        if (
            resolution.defaultScheduleId
            && !store.sqlite
                .prepare('SELECT 1 FROM schedule_templates WHERE id = ? AND user_id = ?')
                .get(resolution.defaultScheduleId, userId)
        )
            errors.push({ row, column: 'catégorie', message: 'Échéancier introuvable.' });
    }
    return errors;
}

export function previewImport(
    store: Store,
    userId: string,
    csv: string,
    categoryResolutions: ImportCategoryResolution[] = [],
    matches: MappingMatch[] = [],
): ImportPreview {
    const categories = store.sqlite
        .prepare('SELECT id, name FROM categories WHERE user_id = ? ORDER BY id')
        .all(userId) as ImportCategory[];
    const paymentTypes = store.sqlite
        .prepare('SELECT id, name FROM payment_types WHERE user_id = ? ORDER BY id')
        .all(userId) as ImportCategory[];
    const rules = getMappingRules(store, userId);
    const labels = new Map<string, ImportPreview['categoryLabels'][number]>();
    const initial = parseImport(csv, categories, [], {
        paymentTypes,
        matches,
        onLabel: item => {
            const key = `${item.kind}:${categoryLabelKey(item.label)}`;
            const group = labels.get(key) ?? { label: item.label, rows: [], targetKind: item.kind };
            group.rows.push(item.row);
            labels.set(key, group);
        },
    });
    const categoryLabels = [...labels.values()];
    const resolutionErrors = validateCategoryResolutions(
        store,
        userId,
        categories,
        paymentTypes,
        categoryLabels,
        categoryResolutions,
    );
    const parsed = resolutionErrors.length
        ? { ...initial, errors: [...initial.errors, ...resolutionErrors] }
        : parseImport(csv, categories, categoryResolutions, { paymentTypes, matches });
    const existing = new Map<string, string[]>();
    const add = (row: ImportRow, id: string) => {
        const key = rowKey(row);
        existing.set(key, [...(existing.get(key) ?? []), id]);
    };
    const charges = store.sqlite
        .prepare(
            `SELECT c.id, c.date, c.title, c.category, c.amount,
              c.amount - COALESCE((SELECT SUM(a.amount) FROM allocations a WHERE a.charge_id = c.id), 0)
              - COALESCE((SELECT SUM(a.amount) FROM refund_applications a WHERE a.charge_id = c.id), 0) AS remaining
             FROM charges c WHERE c.user_id = ? ORDER BY c.date, c.id`,
        )
        .all(userId) as (Omit<ImportTarget, 'key'> & { id: string; amount: number })[];
    for (const charge of charges) {
        const category = categories.find(
            item => item.name.trim().toLowerCase() === charge.category.trim().toLowerCase(),
        );
        if (category) add({ ...charge, row: 0, kind: 'charge', categoryId: category.id }, charge.id);
    }
    const payments = store.sqlite
        .prepare('SELECT id, date, label, amount FROM payments WHERE user_id = ? ORDER BY id')
        .all(userId) as { id: string; date: string; label: string | null; amount: number }[];
    for (const payment of payments)
        add({ ...payment, row: 0, kind: 'payment', category: 'Paiement importé' }, payment.id);
    const refunds = store.sqlite
        .prepare(
            `SELECT r.id, r.date, r.title, r.amount, r.category_id AS categoryId, c.name AS category
             FROM refunds r JOIN categories c ON c.id = r.category_id WHERE r.user_id = ? ORDER BY r.id`,
        )
        .all(userId) as {
        id: string;
        date: string;
        title: string;
        amount: number;
        categoryId: string;
        category: string;
    }[];
    for (const refund of refunds) add({ ...refund, row: 0, kind: 'refund' }, refund.id);
    const duplicates: ImportPreview['duplicates'] = [];
    const seen = new Map<string, number>();
    for (const row of parsed.rows) {
        const key = rowKey(row);
        const matches = existing.get(key);
        if (matches?.length) duplicates.push({ row: row.row, marker: `${row.row}:existing:${digest(matches.sort())}` });
        const previous = seen.get(key);
        if (previous !== undefined) duplicates.push({ row: row.row, marker: `${row.row}:file:${previous}` });
        else seen.set(key, row.row);
    }
    const targets: ImportTarget[] = [
        ...charges
            .filter(charge => charge.remaining > 0)
            .map(({ id, date, title, category, remaining }) => ({
                key: `charge:${id}`,
                date,
                title,
                category,
                remaining,
            })),
        ...parsed.rows
            .filter(row => row.kind === 'charge')
            .map(row => ({
                key: `row:${row.row}`,
                date: row.date,
                title: row.title,
                category: row.category,
                remaining: row.amount,
            })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
    const capacity = new Map(targets.map(target => [target.key, target.remaining]));
    const funding = parsed.rows
        .filter(row => row.kind !== 'charge')
        .sort((a, b) => {
            const priority = Number(b.kind === 'refund') - Number(a.kind === 'refund');
            return priority || a.date.localeCompare(b.date) || a.row - b.row;
        });
    const proposals = funding.map(row => {
        let remaining = row.amount;
        const allocations: ImportAllocation[] = [];
        for (const target of targets) {
            if (
                target.date > row.date
                || (row.kind === 'refund' && target.category.trim().toLowerCase() !== row.category.trim().toLowerCase())
            )
                continue;
            const amount = Math.min(remaining, capacity.get(target.key) ?? 0);
            if (amount <= 0) continue;
            allocations.push({ target: target.key, amount });
            capacity.set(target.key, (capacity.get(target.key) ?? 0) - amount);
            remaining -= amount;
        }
        return { row: row.row, allocations };
    });
    return {
        ...parsed,
        categoryLabels,
        duplicates,
        targets,
        proposals,
        snapshot: digest([parsed, categories, paymentTypes, rules, charges, duplicates, categoryResolutions]),
        imported: false,
    };
}

export function validateProposals(preview: ImportPreview, proposals: ImportProposal[]): ImportError[] {
    const errors: ImportError[] = [];
    const targets = new Map(preview.targets.map(target => [target.key, target]));
    const capacity = new Map(preview.targets.map(target => [target.key, target.remaining]));
    const funding = new Map(preview.rows.filter(row => row.kind !== 'charge').map(row => [row.row, row]));
    const seen = new Set<number>();
    for (const proposal of proposals) {
        const row = funding.get(proposal.row);
        const issue = (message: string) => errors.push({ row: proposal.row, column: 'répartition', message });
        if (!row || seen.has(proposal.row)) {
            issue('Ligne de crédit ou remboursement inconnue ou en double.');
            continue;
        }
        seen.add(proposal.row);
        if (proposal.allocations.reduce((sum, item) => sum + item.amount, 0) > row.amount)
            issue('La répartition dépasse le montant disponible.');
        const used = new Set<string>();
        for (const allocation of proposal.allocations) {
            const target = targets.get(allocation.target);
            if (!target || target.date > row.date || used.has(allocation.target)) {
                issue('Charge inconnue, postérieure au mouvement ou sélectionnée plusieurs fois.');
                continue;
            }
            used.add(allocation.target);
            const remaining = capacity.get(target.key) ?? 0;
            if (!Number.isSafeInteger(allocation.amount) || allocation.amount <= 0 || allocation.amount > remaining)
                issue('Montant invalide ou supérieur au reste dû de la charge.');
            capacity.set(target.key, remaining - allocation.amount);
        }
    }
    for (const row of funding.values())
        if (!seen.has(row.row))
            errors.push({
                row: row.row,
                column: 'répartition',
                message: 'Répartition manquante (une liste vide est acceptée).',
            });
    return errors;
}

export function commitImport(
    store: Store,
    userId: string,
    preview: ImportPreview,
    proposals: ImportProposal[],
    categoryResolutions: ImportCategoryResolution[] = [],
) {
    const ids = new Map<string, string>();
    for (const resolution of categoryResolutions) {
        if (resolution.kind !== 'new') continue;
        const id = randomUUID();
        store.sqlite
            .prepare('INSERT INTO categories VALUES (?, ?, ?, ?)')
            .run(id, userId, resolution.name.trim(), resolution.defaultScheduleId);
        ids.set(pendingCategoryId(resolution.label), id);
    }
    for (const row of preview.rows.filter(row => row.kind === 'charge')) {
        const id = randomUUID();
        ids.set(`row:${row.row}`, id);
        store.sqlite
            .prepare(
                'INSERT INTO charges (id, user_id, title, category, date, amount, installments) VALUES (?, ?, ?, ?, ?, ?, 1)',
            )
            .run(id, userId, row.title, row.category, row.date, row.amount);
        store.sqlite.prepare('INSERT INTO charge_installments VALUES (?, 0, ?, ?)').run(id, row.date, row.amount);
    }
    for (const target of preview.targets)
        if (target.key.startsWith('charge:')) ids.set(target.key, target.key.slice('charge:'.length));
    for (const row of preview.rows.filter(row => row.kind !== 'charge')) {
        const id = randomUUID();
        if (row.kind === 'payment')
            store.sqlite
                .prepare('INSERT INTO payments (id, user_id, date, category, label, amount) VALUES (?, ?, ?, ?, ?, ?)')
                .run(id, userId, row.date, row.category, row.label, row.amount);
        else
            store.sqlite
                .prepare(
                    'INSERT INTO refunds (id, user_id, date, title, category_id, amount) VALUES (?, ?, ?, ?, ?, ?)',
                )
                .run(id, userId, row.date, row.title, ids.get(row.categoryId) ?? row.categoryId, row.amount);
        const proposal = proposals.find(item => item.row === row.row);
        if (!proposal) throw new Error('Répartition non validée.');
        for (const allocation of proposal.allocations) {
            const chargeId = ids.get(allocation.target);
            if (!chargeId) throw new Error('Charge non validée.');
            if (row.kind === 'payment')
                store.sqlite
                    .prepare('INSERT INTO allocations (id, payment_id, charge_id, amount) VALUES (?, ?, ?, ?)')
                    .run(randomUUID(), id, chargeId, allocation.amount);
            else
                store.sqlite
                    .prepare('INSERT INTO refund_applications (id, refund_id, charge_id, amount) VALUES (?, ?, ?, ?)')
                    .run(randomUUID(), id, chargeId, allocation.amount);
        }
    }
}
