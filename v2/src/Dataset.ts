/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */

type V2Model = {
    charges: { date: string; categorie: string; libelle: string; montant: number }[];
    payments: { date: string; type: string; montant: number; ref: string }[];
    installments: { charge: number; date: string; montant: number }[]; // indexes into `charges`
    allocations: { payment: number; charge: number; montant: number }[]; // indexes into `payments` / `charges`
};

/** Accepts a Date (possibly from another realm), an ISO string or a dd/mm/yyyy string. */
function v2ToIso(value: unknown): string {
    if (Object.prototype.toString.call(value) === '[object Date]') {
        const d = value as Date;
        return v2FormatIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    const text = (typeof value === 'string' ? value : '').trim();
    const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (fr) return v2FormatIsoDate(Number(fr[3]), Number(fr[2]), Number(fr[1]));
    return text;
}

const v2IsBlank = (value: unknown): boolean => value === '' || value === null || value === undefined;

/**
 * Converts v1 rows (A date, B label, C amount, D count, E payment date, F sum, G paid) into the v2 model. A row with an
 * amount in C starts a charge; the following rows are its installments.
 */
function v2MigrateV1Rows(rows: unknown[][]): V2Model {
    const model: V2Model = { charges: [], payments: [], installments: [], allocations: [] };
    const usedLabels: Record<string, number> = {};
    let current = -1;
    const children: { date: string; amount: number; paid: boolean }[][] = [];

    rows.forEach(row => {
        const [date, label, amount, , payDate, sum, paid] = row;
        if (!v2IsBlank(amount) && !isNaN(Number(amount))) {
            const base = (typeof label === 'string' ? label : '').trim() || `Charge ${model.charges.length + 1}`;
            const dateIso = v2ToIso(date);
            const count = (usedLabels[`${dateIso}|${base}`] = (usedLabels[`${dateIso}|${base}`] || 0) + 1);
            model.charges.push({
                date: dateIso,
                categorie: 'Autre',
                libelle: count > 1 ? `${base} (${count})` : base,
                montant: Number(amount),
            });
            children.push([]);
            current = model.charges.length - 1;
        } else if (current >= 0 && !v2IsBlank(sum) && !isNaN(Number(sum))) {
            children[current].push({
                date: v2IsBlank(payDate) ? model.charges[current].date : v2ToIso(payDate),
                amount: Number(sum),
                paid: paid === true,
            });
        }
    });

    children.forEach((list, chargeIndex) => {
        if (list.length > 1) {
            list.forEach(c => model.installments.push({ charge: chargeIndex, date: c.date, montant: c.amount }));
        }
        list.filter(c => c.paid).forEach(c => {
            model.payments.push({
                date: c.date,
                type: 'Autre',
                montant: c.amount,
                ref: `MIG-${model.payments.length + 1}`,
            });
            model.allocations.push({ payment: model.payments.length - 1, charge: chargeIndex, montant: c.amount });
        });
    });
    return model;
}

/** Sample data relative to a reference date so the demo always shows a mix of statuses. */
function v2DemoModel(todayIso: string): V2Model {
    const at = (months: number): string => v2AddMonths(todayIso, months);
    const roof = v2GenerateSchedule(1800, 3, at(-3), 1);
    return {
        charges: [
            { date: at(-3), categorie: 'Travaux', libelle: 'Réfection du toit', montant: 1800 },
            { date: at(-2), categorie: 'Appel de fonds', libelle: 'Appel de fonds trimestre', montant: 900 },
            { date: at(1), categorie: 'Frais', libelle: 'Frais de travaux', montant: 60 },
            { date: at(-1), categorie: 'Régularisation', libelle: 'Régularisation annuelle', montant: 120 },
        ],
        payments: [
            { date: at(-2), type: 'Virement', montant: 1000, ref: '' },
            { date: at(-1), type: 'Chèque', montant: 680, ref: 'CH-1' },
            { date: todayIso, type: 'Remboursement', montant: -50, ref: 'REG' },
        ],
        installments: roof.map(i => ({ charge: 0, date: i.date, montant: i.amount })),
        allocations: [
            { payment: 0, charge: 0, montant: 600 },
            { payment: 0, charge: 1, montant: 400 },
            { payment: 1, charge: 1, montant: 500 },
            { payment: 1, charge: 2, montant: 60 },
            { payment: 1, charge: 3, montant: 120 },
            { payment: 2, charge: 3, montant: -50 },
        ],
    };
}

function v2ToSheetDate(iso: string): Date {
    const { y, m, d } = v2ParseIsoDate(iso);
    return new Date(y, m - 1, d);
}

/** Number of the first free row of a table, based on its first input column (never on getLastRow). */
function v2NextFreeRow(sheet: GoogleAppsScript.Spreadsheet.Sheet): number {
    const values = sheet.getRange(2, 1, V2_MAX_ROWS - 1, 1).getValues();
    let last = 0;
    values.forEach((v, i) => {
        if (!v2IsBlank(v[0])) last = i + 1;
    });
    return last + 2;
}

function v2AppendInputs(sheet: GoogleAppsScript.Spreadsheet.Sheet, rows: unknown[][]): number {
    const start = v2NextFreeRow(sheet);
    if (rows.length === 0) return start;
    if (start + rows.length - 1 > V2_MAX_ROWS) throw new Error('Limite de 1000 lignes atteinte');
    sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
    return start;
}

/**
 * Appends a model to the workbook. Keys are computed by the sheet (locale-dependent number text), so they are read back
 * after a flush instead of being rebuilt in script.
 */
function v2ImportModel(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, model: V2Model): void {
    const charges = v2Sheet(ss, 'charges');
    const payments = v2Sheet(ss, 'paiements');
    const chargeStart = v2AppendInputs(
        charges,
        model.charges.map(c => [v2ToSheetDate(c.date), c.categorie, c.libelle, c.montant]),
    );
    const paymentStart = v2AppendInputs(
        payments,
        model.payments.map(p => [v2ToSheetDate(p.date), p.type, p.montant, p.ref]),
    );
    SpreadsheetApp.flush();
    const keyOf = (
        sheet: GoogleAppsScript.Spreadsheet.Sheet,
        key: V2TableKey,
        start: number,
        count: number,
    ): string[] =>
        count === 0
            ? []
            : sheet
                  .getRange(start, v2ColIndex(key, 'cle'), count, 1)
                  .getValues()
                  .map(r => String(r[0]));
    const chargeKeys = keyOf(charges, 'charges', chargeStart, model.charges.length);
    const paymentKeys = keyOf(payments, 'paiements', paymentStart, model.payments.length);

    v2AppendInputs(
        v2Sheet(ss, 'affectations'),
        model.allocations.map(a => [paymentKeys[a.payment], chargeKeys[a.charge], a.montant]),
    );
    v2AppendInputs(
        v2Sheet(ss, 'echeances'),
        model.installments.map(i => [chargeKeys[i.charge], v2ToSheetDate(i.date), i.montant]),
    );
}

function v2ImportFromV1(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, v1SpreadsheetId: string): V2Model {
    const source = SpreadsheetApp.openById(v1SpreadsheetId);
    const range = source.getRangeByName('TableCharges');
    if (!range) throw new Error('Plage nommée « TableCharges » introuvable dans le classeur v1');
    const model = v2MigrateV1Rows(range.getValues());
    v2ImportModel(ss, model);
    return model;
}
