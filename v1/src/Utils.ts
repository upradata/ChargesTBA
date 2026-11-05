/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */
type TryCatchOptions = {
    logError?: boolean;
    logger?: (...data: unknown[]) => void;
};

function tryCatch(
    callback: () => void,
    onErrorMessage = '',
    { logError = true, logger = console.warn }: TryCatchOptions = {},
): void {
    try {
        callback();
    } catch (e) {
        const log = logger || console.warn;

        log(onErrorMessage);

        if (logError) {
            const message = e instanceof Error ? 'message: ' + e.message : 'Unknown error occured.';
            const stack =
                e instanceof Error
                    ? '\nThe stack is →\n' + JSON.stringify(e.stack, null, 2)
                    : '\n→ ' + e
                      ? String(e)
                      : '';

            log(message + stack);
        }
    }
}

type Table = {
    startRow: number; // ligne d'en-tête
    startCol: number;
    lastRow: number;
    lastCol: number;
};

function getTableByName(sheet: GoogleAppsScript.Spreadsheet.Sheet, tableName: string): Table {
    const tableRange = sheet.getParent().getRangeByName(tableName);

    if (!tableRange) throw new Error(`Table with name "${tableName}" does not exist`);

    return parseRangeA1(tableRange.getA1Notation());
}

type TableData = {
    values: unknown[][];
    formulas: string[][]; // '' when the cell has no formula
    backgrounds: (string | null)[][];
    startRow: number; // absolute sheet row of the first data row
    startCol: number;
    nbColumns: number;
    inserted: { afterRow: number; count: number } | null; // relative row after which rows were spliced in
    validationClearRows: number[]; // relative rows whose Payé validation must be cleared after the write
    snapshot: { values: string; backgrounds: string }; // état initial, pour ne réécrire que ce qui a changé
};

type TimingEntry = { stage: string; durationMs: number };

function measureStage<T>(timings: TimingEntry[] | null, stage: string, callback: () => T): T {
    if (!timings) return callback();

    const startedAt = Date.now();
    try {
        return callback();
    } finally {
        timings.push({ stage, durationMs: Date.now() - startedAt });
    }
}

const mergeFormulas = ({ values, formulas }: Pick<TableData, 'values' | 'formulas'>): unknown[][] =>
    values.map((row, r) => row.map((value, c) => formulas[r][c] || value));

/** Reads values, formulas and backgrounds of the data range in 3 API calls. */
function loadTable(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    { startRow, startCol, lastRow, lastCol }: Table,
    timings: TimingEntry[] | null,
): TableData {
    // +1 ligne pour exclure l'en-tête
    const dataRange = measureStage(timings, 'getDataRange', () =>
        sheet.getRange(startRow + 1, startCol, lastRow - startRow, lastCol - startCol + 1),
    );
    const values = measureStage(timings, 'readValues', () => dataRange.getValues());
    const formulas = measureStage(timings, 'readFormulas', () => dataRange.getFormulas());
    const backgrounds = measureStage(timings, 'readBackgrounds', () =>
        dataRange.getBackgrounds().map(row => row.map(color => (color === '#ffffff' ? null : color))),
    );
    const snapshot = measureStage(timings, 'buildSnapshot', () => ({
        values: JSON.stringify(mergeFormulas({ values, formulas })),
        backgrounds: JSON.stringify(backgrounds),
    }));

    return {
        values,
        formulas,
        backgrounds,
        startRow: startRow + 1,
        startCol,
        nbColumns: lastCol - startCol + 1,
        inserted: null,
        validationClearRows: [],
        snapshot,
    };
}

/** Writes back only what changed: values and backgrounds each in one call, plus one insert if rows were added. */
function writeTable(sheet: GoogleAppsScript.Spreadsheet.Sheet, data: TableData, timings: TimingEntry[] | null): void {
    const { values, backgrounds, startRow, startCol, nbColumns, inserted, snapshot } = data;

    if (inserted) {
        measureStage(timings, 'insertRows', () =>
            sheet.insertRowsAfter(startRow + inserted.afterRow - 1, inserted.count),
        );
    }

    const merged = mergeFormulas(data);
    const valuesChanged = !!inserted || JSON.stringify(merged) !== snapshot.values;
    const backgroundsChanged = !!inserted || JSON.stringify(backgrounds) !== snapshot.backgrounds;

    if (valuesChanged || backgroundsChanged) {
        const range = measureStage(timings, 'getWriteRange', () =>
            sheet.getRange(startRow, startCol, values.length, nbColumns),
        );
        if (valuesChanged) measureStage(timings, 'writeValues', () => range.setValues(merged));
        if (backgroundsChanged) measureStage(timings, 'writeBackgrounds', () => range.setBackgrounds(backgrounds));
    }

    if (data.validationClearRows.length > 0) {
        const column = columnToLetter(startCol + COLUMNS.paye - 1);
        const a1Notations = data.validationClearRows.map(row => `${column}${startRow + row - 1}`);

        tryCatch(
            () =>
                measureStage(timings, 'clearValidations', () => sheet.getRangeList(a1Notations).clearDataValidations()),
            'La cellule est verrouillée par le type de colonne.',
        );
    }
}

function columnToLetter(column: number): string {
    let letters = '';
    for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) {
        letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
    }
    return letters;
}

function parseRangeA1(a1Notation: string): {
    startRow: number;
    startCol: number;
    lastRow: number;
    lastCol: number;
} {
    const [first, last = first] = a1Notation.split(':');

    const parse = (a1: string): { row: number; col: number } => {
        const [, letters, row] = /^\$?([A-Z]+)\$?(\d+)$/.exec(a1) ?? [];
        if (!letters) throw new Error(`Invalid A1 notation: "${a1}"`);
        return { row: Number(row), col: letters.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) };
    };

    const start = parse(first);
    const end = parse(last);

    return { startRow: start.row, startCol: start.col, lastRow: end.row, lastCol: end.col };
}

function isInTable(
    { startRow, startCol, lastRow, lastCol }: Table,
    { row, column }: { row: number; column: number },
): boolean {
    return row >= startRow && row <= lastRow && column >= startCol && column <= lastCol;
}
