import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInContext, createContext } from 'node:vm';

const context = createContext({ console });

for (const file of ['Utils.js', 'Code.js']) {
    runInContext(await readFile(new URL(`../dist/${file}`, import.meta.url), 'utf8'), context);
}

const columns = runInContext('COLUMNS', context);
const createCreditRows = runInContext('createCreditRows', context);
const refreshAllRows = runInContext('refreshAllRows', context);

const NB_COLUMNS = 9;
const emptyRow = () => Array(NB_COLUMNS).fill('');

// rows: arrays of [montant, nbPaiements, somme, paye] per row, starting at sheet row 2
function createData(rows, { column = columns.nbPaiments } = {}) {
    const build = ([montant = '', nb = '', somme = '', paye = '']) => {
        const row = emptyRow();
        row[columns.montant - 1] = montant;
        row[columns.nbPaiments - 1] = nb;
        row[columns.somme - 1] = somme;
        row[columns.paye - 1] = paye;

        return row;
    };

    return {
        values: rows.map(build),
        formulas: rows.map(emptyRow),
        backgrounds: rows.map(() => Array(NB_COLUMNS).fill(null)),
        startRow: 2,
        startCol: 1,
        nbColumns: NB_COLUMNS,
        inserted: null,
        validationClearRows: [],
        absoluteRow: 2,
        row: 1,
        column,
    };
}

test('existing payment rows are counted before adding more rows', () => {
    runInContext('DEBUG_MODE = true', context);
    const data = createData([
        [120, 2],
        ['', '', 60],
        ['', '', 60],
        [50, 1],
        ['', '', 50],
    ]);

    createCreditRows(1, data);

    assert.equal(data.inserted, null);
    assert.equal(data.values.length, 5);
});

test('non-positive and non-finite payment amounts or counts are rejected', () => {
    runInContext('DEBUG_MODE = true', context);
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const invalidPayments = createData([[120, invalid]]);
        const invalidAmount = createData([[invalid, 2]]);

        createCreditRows(1, invalidPayments);
        createCreditRows(1, invalidAmount);

        for (const data of [invalidPayments, invalidAmount]) {
            assert.equal(data.inserted, null, `${invalid} should not create payment rows`);
            assert.equal(data.values.length, 1);
        }
    }
});

test('rows are spliced in memory and amounts split with a closing formula', () => {
    runInContext('DEBUG_MODE = true', context);
    const data = createData([
        [100, 3],
        [50, 1],
        ['', '', 50],
    ]);

    createCreditRows(1, data);

    assert.equal(data.inserted.afterRow, 1);
    assert.equal(data.inserted.count, 3);
    assert.equal(data.values.length, 6);
    const somme = columns.somme - 1;
    assert.equal(data.values[1][somme], 33.33);
    assert.equal(data.values[2][somme], 33.33);
    assert.equal(data.values[3][somme], 33.34);
    assert.equal(data.formulas[3][somme], '=C2-SUM(F3:F4)');
    assert.equal(data.values[4][columns.montant - 1], 50);
});

test('refreshAllRows colors debt rows and reports progress in memory', () => {
    runInContext('DEBUG_MODE = true', context);
    const data = createData([
        [100, 2],
        ['', '', 60, true],
        ['', '', 40, true],
    ]);

    refreshAllRows(data);

    assert.equal(data.backgrounds[0][0], '#e8e8e8');
    assert.equal(data.backgrounds[0][columns.montant - 1], '#d9ead3');
    assert.equal(data.values[1][columns.remboursement - 1], '60.00 € / 100.00 € → reste: 40.00 €');
    assert.equal(data.values[2][columns.avancement - 1], 1);
});
