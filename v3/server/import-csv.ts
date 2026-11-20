import { addMonths } from '../shared/schedule';

import type { MappingKind, MappingLabel, MappingMatch } from './csv-mappings';

type CategorizedRow = {
    row: number;
    date: string;
    title: string;
    category: string;
    categoryId: string;
    amount: number;
};
export type ImportRow =
    | (CategorizedRow & { kind: 'charge' })
    | (CategorizedRow & { kind: 'refund' })
    | { row: number; kind: 'payment'; date: string; label: string | null; category: string; amount: number };
export type ImportCategory = { id: string; name: string };
export type ImportCategoryResolution =
    | { label: string; kind: 'existing'; categoryId: string; targetKind?: MappingKind }
    | { label: string; kind: 'new'; name: string; defaultScheduleId: string | null };
export type UnresolvedCategory = { label: string; rows: number[] };
export type ImportError = { row: number; column: string; message: string };
export const MAX_CSV_BYTES = 1_000_000;
export const MAX_CSV_ROWS = 1000;

export function categoryLabelKey(label: string) {
    return label.trim().toLowerCase();
}

export function pendingCategoryId(label: string) {
    return `pending-category:${categoryLabelKey(label)}`;
}

const aliases: Record<string, string> = {
    date: 'date',
    label: 'label',
    libelle: 'label',
    credit: 'credit',
    debit: 'debit',
};

function headerName(value: string) {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function csvRows(csv: string): { row: number; fields: string[] }[] {
    const text = csv.replace(/^\uFEFF/, '');
    let comma = 0;
    let semicolon = 0;
    let quoted = false;

    for (let i = 0; i < text.length && (quoted || (text[i] !== '\n' && text[i] !== '\r')); i++) {
        if (text[i] === '"') {
            if (quoted && text[i + 1] === '"') i++;
            else quoted = !quoted;
        } else if (!quoted && text[i] === ',') comma++;
        else if (!quoted && text[i] === ';') semicolon++;
    }

    if ((comma === 0 && semicolon === 0) || (comma > 0 && semicolon > 0)) throw new Error('Séparateur CSV invalide.');

    const separator = comma ? ',' : ';';
    const rows: { row: number; fields: string[] }[] = [];
    let fields: string[] = [];
    let field = '';
    let line = 1;
    let start = 1;
    let inQuotes = false;
    let closed = false;

    const finishRow = () => {
        fields.push(field);

        if (fields.some(value => value.trim() !== '')) rows.push({ row: start, fields });

        if (rows.length > MAX_CSV_ROWS + 1) throw new Error(`Maximum ${MAX_CSV_ROWS} lignes de données.`);

        fields = [];
        field = '';
        closed = false;
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                    closed = true;
                }
            } else {
                field += char;

                if (char === '\n') line++;
            }
        } else if (char === separator) {
            fields.push(field);
            field = '';
            closed = false;
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i++;

            finishRow();
            line++;
            start = line;
        } else if (char === '"' && field === '' && !closed) {
            inQuotes = true;
        } else if (char === '"' || closed) {
            throw new Error(`Syntaxe CSV invalide à la ligne ${line}.`);
        } else {
            field += char;
        }
    }

    if (inQuotes) throw new Error(`Guillemets non fermés à la ligne ${start}.`);

    if (field !== '' || fields.length || closed) finishRow();

    return rows;
}

function parseDate(value: string): string {
    const trimmed = value.trim();
    const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    const iso = french ? `${french[3]}-${french[2]}-${french[1]}` : trimmed;
    addMonths(iso, 0);

    return iso;
}

function parseAmount(value: string): number {
    const match = /^(-?)(\d{1,7})(?:[,.](\d{1,2}))?$/.exec(value.trim());

    if (!match) throw new Error('Montant invalide (deux décimales au maximum).');

    const result = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));

    if (result > 100_000_000) throw new Error('Montant supérieur à la limite autorisée.');

    return match[1] ? -result : result;
}

export function parseImport(
    csv: string,
    categories: ImportCategory[],
    categoryResolutions: ImportCategoryResolution[] = [],
    options: {
        paymentTypes?: ImportCategory[];
        matches?: MappingMatch[];
        onLabel?: (item: MappingLabel & { row: number }) => void;
    } = {},
): { rows: ImportRow[]; errors: ImportError[]; unresolvedCategories: UnresolvedCategory[] } {
    const errors: ImportError[] = [];
    const rows: ImportRow[] = [];
    const unresolvedCategories = new Map<string, UnresolvedCategory>();
    const resolutions = new Map(
        categoryResolutions.map(item => [
            `${item.kind === 'existing' ? (item.targetKind ?? 'charge') : 'charge'}:${categoryLabelKey(item.label)}`,
            item,
        ]),
    );
    const matches = new Map(options.matches?.map(item => [`${item.kind}:${item.label}`, item.targetId]) ?? []);

    if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES)
        return {
            rows,
            errors: [{ row: 0, column: 'fichier', message: 'Fichier trop volumineux.' }],
            unresolvedCategories: [],
        };

    let parsed: ReturnType<typeof csvRows>;

    try {
        parsed = csvRows(csv);
    } catch (error) {
        return {
            rows,
            errors: [{ row: 0, column: 'fichier', message: error instanceof Error ? error.message : 'CSV invalide.' }],
            unresolvedCategories: [],
        };
    }

    const header = parsed[0];

    if (!header)
        return { rows, errors: [{ row: 1, column: 'en-tête', message: 'Fichier vide.' }], unresolvedCategories: [] };

    const names = header.fields.map(value => aliases[headerName(value)] ?? headerName(value));
    const required = ['date', 'label', 'credit', 'debit'];
    const missing = required.filter(name => !names.includes(name));

    if (missing.length || new Set(names).size !== names.length || names.some(name => !required.includes(name))) {
        return {
            rows,
            errors: [
                {
                    row: header.row,
                    column: 'en-tête',
                    message:
                        'Utilisez exactement les quatre colonnes date, libellé, crédit, débit (anglais : date, label, credit, debit), dans l’ordre souhaité et sans doublon. Les anciens formats type/amount ne sont plus acceptés.',
                },
            ],
            unresolvedCategories: [],
        };
    }

    if (parsed.length === 1)
        return {
            rows,
            errors: [{ row: 0, column: 'fichier', message: 'Aucune ligne de données.' }],
            unresolvedCategories: [],
        };

    for (const entry of parsed.slice(1)) {
        const issue = (column: string, message: string) => errors.push({ row: entry.row, column, message });

        if (entry.fields.length !== names.length) {
            issue('ligne', 'Nombre de colonnes incorrect.');

            continue;
        }

        const value = (name: string) => entry.fields[names.indexOf(name)]?.trim() ?? '';
        let date = '';

        try {
            date = parseDate(value('date'));
        } catch {
            issue('date', 'Date invalide.');
        }

        const label = value('label');

        if (label.length > 120) issue('libellé', 'Libellé trop long (120 caractères maximum).');

        let amount = 0;
        let rowKind: 'charge' | 'payment' | 'refund' = 'payment';

        try {
            const credit = value('credit') ? parseAmount(value('credit')) : 0;
            const debit = value('debit') ? parseAmount(value('debit')) : 0;

            if (credit < 0) throw new Error('Un crédit doit être positif. Un remboursement est un débit négatif.');

            if ((credit !== 0) === (debit !== 0))
                throw new Error('Renseignez un seul crédit ou débit non nul ; laissez l’autre vide ou à zéro.');

            rowKind = debit < 0 ? 'refund' : debit > 0 ? 'charge' : 'payment';
            amount = Math.abs(debit || credit);
        } catch (error) {
            issue('crédit/débit', error instanceof Error ? error.message : 'Montant invalide.');
        }

        let category: ImportCategory | undefined;
        let categoryNeedsResolution = false;
        const targetKind = rowKind === 'payment' ? 'payment' : 'charge';
        if (label && !errors.some(error => error.row === entry.row))
            options.onLabel?.({ label, kind: targetKind, row: entry.row });

        if (rowKind !== 'payment') {
            if (!label) issue('libellé', 'Libellé requis pour une charge ou un remboursement.');
            else {
                const resolution = resolutions.get(`charge:${categoryLabelKey(label)}`);
                if (resolution?.kind === 'existing') {
                    category = categories.find(item => item.id === resolution.categoryId);
                    categoryNeedsResolution = !category;
                } else if (resolution?.kind === 'new') {
                    category = { id: pendingCategoryId(label), name: resolution.name.trim() };
                } else {
                    const matchedId = matches.get(`charge:${label}`);
                    const exactMatches = categories.filter(
                        item => categoryLabelKey(item.name) === categoryLabelKey(label),
                    );

                    if (matchedId) category = categories.find(item => item.id === matchedId);
                    else if (exactMatches.length === 1) category = exactMatches[0];
                    else categoryNeedsResolution = true;
                }
            }
        } else if (label) {
            const resolution = resolutions.get(`payment:${categoryLabelKey(label)}`);
            const matchedId = resolution?.kind === 'existing' ? resolution.categoryId : matches.get(`payment:${label}`);
            if (matchedId) category = options.paymentTypes?.find(item => item.id === matchedId);
        }

        if (errors.some(error => error.row === entry.row)) continue;

        if (rowKind !== 'payment' && categoryNeedsResolution) {
            const key = categoryLabelKey(label);
            const unresolved = unresolvedCategories.get(key) ?? { label: label.trim(), rows: [] };
            unresolved.rows.push(entry.row);
            unresolvedCategories.set(key, unresolved);

            continue;
        }

        if (rowKind !== 'payment' && category)
            rows.push({
                row: entry.row,
                kind: rowKind,
                date,
                title: label,
                category: category.name,
                categoryId: category.id,
                amount,
            });
        else if (rowKind === 'payment')
            rows.push({
                row: entry.row,
                kind: 'payment',
                date,
                label: label || null,
                category: category?.name ?? 'Paiement importé',
                amount,
            });
    }

    return { rows, errors, unresolvedCategories: [...unresolvedCategories.values()] };
}
