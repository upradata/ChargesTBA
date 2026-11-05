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

function createData({ payments = 2, amount = 120, debtRows = [1, 4], rowCount = 6 } = {}) {
    const insertedRows = [];
    const values = new Map([
        ['1:3', amount],
        ['1:4', payments],
        ...debtRows.filter(row => row !== 1).map(row => [`${row}:3`, 50]),
    ]);
    const data = {
        absoluteRow: 2,
        column: columns.nbPaiments,
        row: 1,
        table: { dataRange: { getNumRows: () => rowCount } },
        sheet: { insertRowsAfter: (...args) => insertedRows.push(args) },
        getCell(row, column) {
            return {
                getValue: () => values.get(`${row}:${column}`) ?? '',
                clearContent() {},
                clearDataValidations() {},
                setFormula() {},
                setValue() {},
            };
        },
    };
    return { data, insertedRows };
}

test('existing payment rows are counted before adding more rows', () => {
    runInContext('DEBUG_MODE = true', context);
    const { data, insertedRows } = createData();

    createCreditRows(1, data);

    assert.deepEqual(insertedRows, []);
});

test('non-positive and non-finite payment amounts or counts are rejected', () => {
    runInContext('DEBUG_MODE = true', context);
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        for (const field of ['payments', 'amount']) {
            const { data, insertedRows } = createData({ [field]: invalid });

            createCreditRows(1, data);

            assert.deepEqual(insertedRows, [], `${field}=${invalid} should not create payment rows`);
        }
    }
});
