/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */
// Définissez un drapeau global en haut de votre script principal
let DEBUG_MODE: boolean = false; // Passez à true pendant vos phases de test/debug
let PERFORMANCE_TIMING_ENABLED: boolean = false; // Enable temporarily without changing DEBUG_MODE behavior.

// A=1 (Date), B=2 (Type), C=3 (Montant), D=4 (Nombre de paiements),
// E=5 (Date paiement), F=6 (Somme), G=7 (Payé), H=8 (Remboursement effectué), I=9 (% Avancement)

const COLUMNS = {
    date: 1,
    type: 2,
    montant: 3,
    nbPaiments: 4,
    somme: 6,
    paye: 7,
    remboursement: 8,
    avancement: 9,
};

const NB_COLUMNS = Object.keys(COLUMNS).length;

const TABLE_NAME = 'TableCharges';

const COLORS = {
    debitRow: '#e8e8e8', // Gris foncé pour la ligne principale
    debitPaid: '#d9ead3', // Vert clair
};

const isStrictPositiveNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;
const round = (number: number): string => number.toFixed(2);

let isExecuting = false;

/** Déclencheur automatique lors de la modification de la feuille */
function onEdit(e: Pick<GoogleAppsScript.Events.SheetsOnEdit, 'range'> | undefined): void {
    if (isExecuting) return; // Empêche la ré-entrance si le script modifie lui-même la feuille

    if (!e?.range) return;

    try {
        isExecuting = true;
        refresh(e.range);
    } finally {
        isExecuting = false; // Libère le verrou dans tous les cas (même en cas d'erreur)
    }
}

/** Tableau chargé en mémoire (lignes et colonnes 1-based relatives aux données, en-tête exclu) + cellule éditée. */
type ChargeData = TableData & {
    absoluteRow: number;
    row: number;
    column: number;
};

const getValue = ({ values }: TableData, row: number, column: number): unknown => values[row - 1]?.[column - 1];

function setValue(data: TableData, row: number, column: number, value: unknown): void {
    data.values[row - 1][column - 1] = value;
    data.formulas[row - 1][column - 1] = '';
}

function setFormula(data: TableData, row: number, column: number, formula: string): void {
    data.formulas[row - 1][column - 1] = formula;
}

const getA1 = (data: TableData, row: number, column: number): string =>
    `${columnToLetter(data.startCol + column - 1)}${data.startRow + row - 1}`;

function refresh(range: GoogleAppsScript.Spreadsheet.Range): void | false {
    const timings: TimingEntry[] | null = PERFORMANCE_TIMING_ENABLED ? [] : null;
    const startedAt = timings ? Date.now() : 0;

    try {
        const { sheet, absoluteRow, absoluteColumn, table } = measureStage(timings, 'resolveTable', () => {
            const sheet = range.getSheet();
            const { startRow: absoluteRow, startCol: absoluteColumn } = parseRangeA1(range.getA1Notation());
            const table = getTableByName(sheet, TABLE_NAME);
            return { sheet, absoluteRow, absoluteColumn, table };
        });

        if (table.lastRow === table.startRow) return;

        if (!isInTable(table, { row: absoluteRow, column: absoluteColumn })) return false; // current cell not in table

        const row = absoluteRow - table.startRow; // 1 = première ligne de données
        const column = absoluteColumn - table.startCol + 1;

        if (row < 1) return false; // en-tête

        const data: ChargeData = { ...loadTable(sheet, table, timings), absoluteRow, row, column };

        console.info(`Charges TBA → Running change on cell (row: ${row}, column: ${column})`);

        measureStage(timings, 'createCreditRows', () => createCreditRows(row, data));
        measureStage(timings, 'refreshAllRows', () => refreshAllRows(data));
        measureStage(timings, 'writeTable', () => writeTable(sheet, data, timings));
    } finally {
        if (timings) {
            const durationMs = Date.now() - startedAt;
            const stages = timings.map(({ stage, durationMs }) => `${stage}=${durationMs}ms`).join(', ');
            console.info(`Charges TBA timing: total=${durationMs}ms${stages ? `, ${stages}` : ''}`);
        }
    }
}

const isDebtRow = (data: TableData, row: number): boolean => !!getValue(data, row, COLUMNS.montant);

const getRowCount = ({ values }: TableData): number => values.length;

/** Applique mise en forme et statuts sur tout le tableau, en mémoire. */
function refreshAllRows(data: TableData): void {
    for (let row = 1; row <= getRowCount(data); row++) {
        setDebitRowFormat(row, data);
    }

    for (let row = 1; row <= getRowCount(data); row++) {
        if (isDebtRow(data, row)) updateCreditRowStatus(row, data);
    }
}

function askSplitEqually(nbPaiements: number, totalAmount: number, absoluteRow: number): boolean {
    if (DEBUG_MODE || nbPaiements === 1) return true;

    const ui = SpreadsheetApp.getUi();

    return (
        ui.alert(
            `Répartition des paiements (ligne: ${absoluteRow})`,
            `Voulez-vous diviser le montant de ${totalAmount.toFixed(2)} € en ${nbPaiements} paiements égaux ?`,
            ui.ButtonSet.YES_NO,
        ) === ui.Button.YES
    );
}

function createCreditRows(currentRow: number, data: ChargeData): void {
    if (!isDebtRow(data, currentRow) || (data.column !== COLUMNS.nbPaiments && data.column !== COLUMNS.montant)) return;

    const { absoluteRow } = data;

    const totalAmount = getValue(data, currentRow, COLUMNS.montant);
    const nbPaiements = getValue(data, currentRow, COLUMNS.nbPaiments);

    if (!isStrictPositiveNumber(nbPaiements) || !isStrictPositiveNumber(totalAmount)) return;

    let nbCreditRows = 0;
    while (currentRow + nbCreditRows < getRowCount(data) && !isDebtRow(data, currentRow + nbCreditRows + 1)) {
        nbCreditRows++;
    }

    if (nbPaiements === nbCreditRows) return;

    const splitEqually = askSplitEqually(nbPaiements, totalAmount, absoluteRow);

    const nbToInsert = nbPaiements - nbCreditRows;
    if (nbToInsert > 0) {
        // Insertion des n sous-lignes sous la ligne principale (une seule insertion côté feuille, à l'écriture)
        const at = currentRow + nbCreditRows;
        const newRows = (): unknown[][] => Array.from({ length: nbToInsert }, () => Array(data.nbColumns).fill(''));

        data.values.splice(at, 0, ...newRows());
        data.formulas.splice(at, 0, ...newRows().map(r => r.map(String)));
        data.backgrounds.splice(
            at,
            0,
            ...Array.from({ length: nbToInsert }, () => Array<string | null>(data.nbColumns).fill(null)),
        );
        data.inserted = { afterRow: at, count: nbToInsert };
    }

    const equalAmount = splitEqually ? Math.floor((totalAmount / nbPaiements) * 100) / 100 : 0;

    // S'assurer que la ligne principale (parent) n'a pas de case à cocher dans la colonne Payé
    setValue(data, currentRow, COLUMNS.paye, '');
    data.validationClearRows.push(currentRow);

    let sumOfOthers = 0;
    for (let i = 1; i <= nbPaiements; i++) {
        const targetRow = currentRow + i;

        // Gestion de la Somme (Colonne F)
        if (nbPaiements > 1) {
            if (i === nbPaiements) {
                const formulaSum = `=${getA1(data, currentRow, COLUMNS.montant)}-SUM(${getA1(data, currentRow + 1, COLUMNS.somme)}:${getA1(data, currentRow + nbPaiements - 1, COLUMNS.somme)})`;
                setValue(data, targetRow, COLUMNS.somme, totalAmount - sumOfOthers);
                setFormula(data, targetRow, COLUMNS.somme, formulaSum);
            } else if (splitEqually) {
                setValue(data, targetRow, COLUMNS.somme, equalAmount);
                sumOfOthers += equalAmount;
            } else {
                sumOfOthers += Number(getValue(data, targetRow, COLUMNS.somme)) || 0;
            }
        } else {
            setValue(data, targetRow, COLUMNS.somme, totalAmount);
        }
    }
}

function setDebitRowFormat(currentRow: number, data: TableData): void {
    data.backgrounds[currentRow - 1] = Array<string | null>(data.nbColumns).fill(
        isDebtRow(data, currentRow) ? COLORS.debitRow : null,
    );
}

/** Met à jour le statut, l'avancement et colore la case Montant parente en vert si 100% payé */
function updateCreditRowStatus(debitRow: number, data: TableData): void {
    const totalAmount = Number(getValue(data, debitRow, COLUMNS.montant));
    const nbPaiements = getValue(data, debitRow, COLUMNS.nbPaiments);

    if (!isStrictPositiveNumber(nbPaiements)) return;

    let sum = 0;
    let isAllPaid = true;

    for (let i = 1; i <= nbPaiements && debitRow + i <= getRowCount(data); i++) {
        const row = debitRow + i;
        if (isDebtRow(data, row)) break;

        const isPaid = !!getValue(data, row, COLUMNS.paye);
        const amount = Number(getValue(data, row, COLUMNS.somme)) || 0;

        if (isPaid && amount >= 0) {
            const cumulatedCredits = sum + amount;
            const remaining = totalAmount - cumulatedCredits;
            const progress = parseFloat(round(cumulatedCredits / totalAmount));

            setValue(
                data,
                row,
                COLUMNS.remboursement,
                `${round(cumulatedCredits)} € / ${round(totalAmount)} € → reste: ${round(remaining)} €`,
            );
            setValue(data, row, COLUMNS.avancement, progress);
        } else {
            setValue(data, row, COLUMNS.remboursement, '');
            setValue(data, row, COLUMNS.avancement, '');
        }

        sum += amount;
        isAllPaid = isAllPaid && isPaid;
    }

    // Si tous les paiements de la série sont cochés (100% payé), on colore le montant parent en vert
    data.backgrounds[debitRow - 1][COLUMNS.montant - 1] = isAllPaid ? COLORS.debitPaid : COLORS.debitRow;
}
