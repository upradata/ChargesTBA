import { addMonths } from '../shared/schedule';

export type ImportKind = 'charges' | 'payments' | 'solde';
export type ImportRow =
    | { row: number; kind: 'charge'; date: string; title: string; category: string; amount: number }
    | { row: number; kind: 'payment'; date: string; label: string | null; category: string; amount: number };
export type ImportError = { row: number; column: string; message: string };
export const MAX_CSV_BYTES = 1_000_000;
export const MAX_CSV_ROWS = 1000;

const aliases: Record<string, string> = {
    date: 'date',
    label: 'label',
    libelle: 'label',
    type: 'type',
    category: 'type',
    categorie: 'type',
    amount: 'amount',
    montant: 'amount',
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
    const match = /^(\d{1,7})(?:[,.](\d{1,2}))?$/.exec(value.trim());
    if (!match) throw new Error('Montant invalide (deux décimales au maximum).');
    const result = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    if (result > 100_000_000) throw new Error('Montant supérieur à la limite autorisée.');
    return result;
}

export function parseImport(kind: ImportKind, csv: string): { rows: ImportRow[]; errors: ImportError[] } {
    const errors: ImportError[] = [];
    const rows: ImportRow[] = [];
    if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES)
        return { rows, errors: [{ row: 0, column: 'fichier', message: 'Fichier trop volumineux.' }] };
    let parsed: ReturnType<typeof csvRows>;
    try {
        parsed = csvRows(csv);
    } catch (error) {
        return {
            rows,
            errors: [{ row: 0, column: 'fichier', message: error instanceof Error ? error.message : 'CSV invalide.' }],
        };
    }
    const header = parsed[0];
    if (!header) return { rows, errors: [{ row: 1, column: 'en-tête', message: 'Fichier vide.' }] };
    const names = header.fields.map(value => aliases[headerName(value)] ?? headerName(value));
    const required =
        kind === 'charges'
            ? ['date', 'label', 'type', 'amount']
            : kind === 'payments'
              ? ['date', 'type', 'amount']
              : ['date', 'label', 'type', 'credit', 'debit'];
    const missing = required.filter(name => !names.includes(name));
    if (missing.length || new Set(names).size !== names.length) {
        return {
            rows,
            errors: [
                {
                    row: header.row,
                    column: 'en-tête',
                    message: missing.length ? `Colonnes manquantes : ${missing.join(', ')}.` : 'Colonnes en double.',
                },
            ],
        };
    }
    if (parsed.length === 1)
        return { rows, errors: [{ row: 0, column: 'fichier', message: 'Aucune ligne de données.' }] };
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
        const category = value('type');
        if (!category || category.length > 80) issue('type', 'Type requis (80 caractères maximum).');
        const label = value('label');
        if ((kind !== 'payments' && !label) || label.length > 120)
            issue('label', 'Libellé requis (120 caractères maximum).');
        let amount = 0;
        let rowKind: 'charge' | 'payment' = kind === 'charges' ? 'charge' : 'payment';
        try {
            if (kind === 'solde') {
                const credit = value('credit') ? parseAmount(value('credit')) : 0;
                const debit = value('debit') ? parseAmount(value('debit')) : 0;
                if (credit > 0 === debit > 0) throw new Error('Indiquez un seul crédit ou débit positif.');
                rowKind = debit > 0 ? 'charge' : 'payment';
                amount = debit || credit;
            } else {
                amount = parseAmount(value('amount'));
                if (!amount) throw new Error('Le montant doit être supérieur à zéro.');
            }
        } catch (error) {
            issue(
                kind === 'solde' ? 'credit/debit' : 'amount',
                error instanceof Error ? error.message : 'Montant invalide.',
            );
        }
        if (errors.some(error => error.row === entry.row)) continue;
        if (rowKind === 'charge') rows.push({ row: entry.row, kind: 'charge', date, title: label, category, amount });
        else rows.push({ row: entry.row, kind: 'payment', date, label: label || null, category, amount });
    }
    return { rows, errors };
}
