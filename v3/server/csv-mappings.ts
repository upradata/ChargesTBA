import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';

import type { openDatabase } from './db';

type Store = ReturnType<typeof openDatabase>;
export type MappingKind = 'charge' | 'payment';
export type MappingRule = {
    id: string;
    pattern: string;
    ignoreCase: boolean;
    position: number;
    categoryId: string | null;
    paymentTypeId: string | null;
};
export type MappingLabel = { label: string; kind: MappingKind };
export type MappingMatch = MappingLabel & { targetId: string };
export const MAX_MAPPING_RULES = 200;

export function initializeCsvMappings(store: Store, userId: string) {
    store.sqlite.transaction(() => {
        if (store.sqlite.prepare('SELECT 1 FROM csv_mappings_initialized WHERE user_id = ?').get(userId)) return;
        const defaults = [
            { name: 'Appel de fonds trimestriel', pattern: 'appel\\s+de\\s+fonds\\s+trimestriel', kind: 'charge' },
            { name: 'Appel fonds de réserve trvx', pattern: 'appel\\s+fonds\\s+de\\s+r[ée]serve', kind: 'charge' },
            { name: 'Travaux toiture', pattern: '(?:trx|travaux)\\s+toiture', kind: 'charge' },
            { name: 'Travaux divers', pattern: '(?:trx|travaux)\\s+divers', kind: 'charge' },
            {
                name: 'Remboursement avance de trésorerie',
                pattern: 'remboursement\\s+avance\\s+tr[ée]sorer',
                kind: 'charge',
            },
            {
                name: 'Régularisation appels de fonds',
                pattern: 'r[ée]gul\\.?\\s+appels?\\s+de\\s+fonds',
                kind: 'charge',
            },
            { name: 'Virement', pattern: 'virement', kind: 'payment' },
            { name: 'Prélèvement automatique', pattern: 'pr[ée]l[èe]vement', kind: 'payment' },
            { name: 'Chèque', pattern: 'ch[èe]que', kind: 'payment' },
        ] as const;
        const insertRule = store.sqlite.prepare(
            'INSERT INTO csv_mapping_rules (id, user_id, pattern, ignore_case, position, category_id, payment_type_id) VALUES (?, ?, ?, 1, ?, ?, ?)',
        );
        defaults.forEach((item, position) => {
            const table = item.kind === 'charge' ? 'categories' : 'payment_types';
            const existing = store.sqlite
                .prepare(`SELECT id FROM ${table} WHERE user_id = ? AND name = ? COLLATE NOCASE`)
                .get(userId, item.name) as { id: string } | undefined;
            const id = existing?.id ?? randomUUID();
            if (!existing) {
                if (item.kind === 'charge')
                    store.sqlite.prepare('INSERT INTO categories VALUES (?, ?, ?, NULL)').run(id, userId, item.name);
                else store.sqlite.prepare('INSERT INTO payment_types VALUES (?, ?, ?)').run(id, userId, item.name);
            }
            insertRule.run(
                randomUUID(),
                userId,
                item.pattern,
                position,
                item.kind === 'charge' ? id : null,
                item.kind === 'payment' ? id : null,
            );
        });
        store.sqlite.prepare('INSERT INTO csv_mappings_initialized VALUES (?)').run(userId);
    })();
}

export function getMappingRules(store: Store, userId: string): MappingRule[] {
    const rows = store.sqlite
        .prepare(
            `SELECT id, pattern, ignore_case AS ignoreCase, position,
                category_id AS categoryId, payment_type_id AS paymentTypeId
             FROM csv_mapping_rules WHERE user_id = ? ORDER BY position, id`,
        )
        .all(userId) as (Omit<MappingRule, 'ignoreCase'> & { ignoreCase: number })[];
    return rows.map(row => ({ ...row, ignoreCase: row.ignoreCase === 1 }));
}

export function validatePattern(pattern: string, ignoreCase: boolean) {
    try {
        new RegExp(pattern, ignoreCase ? 'i' : '');
        return true;
    } catch {
        return false;
    }
}

export async function matchMappingRules(rules: MappingRule[], labels: MappingLabel[]): Promise<MappingMatch[]> {
    if (!rules.length || !labels.length) return [];
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            `const { parentPort, workerData } = require('node:worker_threads');
            try {
                const rules = workerData.rules.map(rule => ({...rule, regex: new RegExp(rule.pattern, rule.ignoreCase ? 'i' : '')}));
                const result = [];
                for (const item of workerData.labels) {
                    const rule = rules.find(rule => (item.kind === 'payment' ? rule.paymentTypeId : rule.categoryId) && rule.regex.test(item.label));
                    if (rule) result.push({...item, targetId: item.kind === 'payment' ? rule.paymentTypeId : rule.categoryId});
                }
                parentPort.postMessage({ result });
            } catch (error) {
                parentPort.postMessage({ error: error instanceof Error ? error.message : 'Expression régulière invalide.' });
            }`,
            { eval: true, workerData: { rules, labels } },
        );
        const timer = setTimeout(() => {
            void worker.terminate();
            reject(new Error('Une règle CSV a dépassé le temps autorisé. Vérifiez les expressions régulières.'));
        }, 2000);
        worker.once('message', (message: { result?: MappingMatch[]; error?: string }) => {
            clearTimeout(timer);
            if (message.error) reject(new Error(`Règle CSV invalide : ${message.error}`));
            else if (message.result) resolve(message.result);
            else reject(new Error('Résultat de correspondance CSV invalide.'));
        });
        worker.once('error', error => {
            clearTimeout(timer);
            reject(error);
        });
        worker.once('exit', code => {
            if (code !== 0) {
                clearTimeout(timer);
                reject(new Error('Échec de la vérification des règles CSV.'));
            }
        });
    });
}
