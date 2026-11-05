import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const ctx = vm.createContext({});
for (const file of ['Schema', 'Schedule', 'Dataset', 'Reference']) {
    vm.runInContext(readFileSync(new URL(`../dist/${file}.js`, import.meta.url), 'utf8'), ctx);
}
ctx.input = null;
const run = (expr, input) => {
    ctx.input = input === undefined ? undefined : JSON.parse(JSON.stringify(input));
    return JSON.parse(JSON.stringify(vm.runInContext(expr, ctx)));
};

test('migration turns v1 rows into charges, installments, payments and allocations', () => {
    const rows = [
        ['2026-01-15', 'Appel T1', 600, 2, '', '', ''],
        ['', '', '', '', '2026-02-01', 300, true],
        ['', '', '', '', '2026-03-01', 300, false],
        ['2026-01-15', 'Appel T1', 100, 1, '', '', ''],
        ['', '', '', '', '2026-02-10', 100, true],
        ['Date', 'Type', 'Montant', '', '', '', ''],
    ];
    const m = run('v2MigrateV1Rows(input)', rows);
    assert.deepEqual(
        m.charges.map(c => c.libelle),
        ['Appel T1', 'Appel T1 (2)'],
    );
    assert.equal(m.installments.length, 2);
    assert.deepEqual(
        m.installments.map(i => i.charge),
        [0, 0],
    );
    assert.equal(m.payments.length, 2);
    assert.deepEqual(m.allocations, [
        { payment: 0, charge: 0, montant: 300 },
        { payment: 1, charge: 1, montant: 100 },
    ]);
});

test('toIso handles dd/mm/yyyy and cross-realm dates', () => {
    assert.equal(run("v2ToIso('05/06/2026')"), '2026-06-05');
    assert.equal(run('v2ToIso(new Date(2026, 5, 5))'), '2026-06-05');
});

test('reference model: objective, lateness and refunds', () => {
    const r = run('v2Reference(input)', {
        today: '2026-06-15',
        charges: [
            { date: '2026-01-01', montant: 300 },
            { date: '2026-12-01', montant: 100 },
        ],
        payments: [{ montant: 150 }, { montant: -20 }],
        allocations: [
            { payment: 0, charge: 0, montant: 100 },
            { payment: 0, charge: 1, montant: 50 },
            { payment: 1, charge: 1, montant: -20 },
        ],
        installments: [
            { charge: 0, date: '2026-03-01', montant: 100 },
            { charge: 0, date: '2026-06-01', montant: 100 },
            { charge: 0, date: '2026-09-01', montant: 100 },
        ],
    });
    assert.deepEqual(r.charges[0], { paye: 100, reste: 200, solde: -200, objectif: 200, retard: 100 });
    assert.deepEqual(r.charges[1], { paye: 30, reste: 70, solde: -70, objectif: 0, retard: 0 });
    assert.deepEqual(r.payments, [
        { affecte: 150, nonAlloue: 0 },
        { affecte: -20, nonAlloue: 0 },
    ]);
});

test('demo model is internally consistent and fully allocated', () => {
    const m = run("v2DemoModel('2026-06-15')");
    const sum = list => Math.round(list.reduce((a, b) => a + b, 0) * 100) / 100;
    assert.equal(sum(m.installments.map(i => i.montant)), m.charges[0].montant);
    m.payments.forEach((p, i) => {
        assert.equal(sum(m.allocations.filter(a => a.payment === i).map(a => a.montant)), p.montant);
    });
});
