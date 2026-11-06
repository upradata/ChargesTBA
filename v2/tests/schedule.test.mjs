import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const ctx = vm.createContext({});
for (const file of ['Schema', 'Schedule']) {
    const code = readFileSync(new URL(`../dist/${file}.js`, import.meta.url), 'utf8');
    vm.runInContext(code, ctx);
}
const run = expr => JSON.parse(JSON.stringify(vm.runInContext(expr, ctx)));

test('addMonths clamps day to month length', () => {
    assert.equal(run("v2AddMonths('2026-01-31', 1)"), '2026-02-28');
    assert.equal(run("v2AddMonths('2028-01-31', 1)"), '2028-02-29');
    assert.equal(run("v2AddMonths('2026-11-15', 3)"), '2027-02-15');
});

test('split amount is exact in cents', () => {
    const parts = run('v2SplitAmount(100, 3)');
    assert.deepEqual(parts, [33.34, 33.33, 33.33]);
    assert.equal(Math.round(parts.reduce((a, b) => a + b, 0) * 100), 10000);
});

test('uniform schedule: quarterly', () => {
    const s = run("v2GenerateSchedule(1200, 4, '2026-01-01', 3)");
    assert.deepEqual(
        s.map(i => i.date),
        ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'],
    );
    assert.ok(s.every(i => i.amount === 300));
});

test('custom schedule sorts dates and shares total', () => {
    const s = run("v2GenerateCustomSchedule(100, '2026-09-01; 2026-03-01')");
    assert.deepEqual(s, [
        { date: '2026-03-01', amount: 50 },
        { date: '2026-09-01', amount: 50 },
    ]);
});

test('invalid inputs throw', () => {
    assert.throws(() => run("v2GenerateCustomSchedule(10, '01/02/2026')"));
    assert.throws(() => run('v2SplitAmount(10, 0)'));
});

test('schema formulas have balanced parentheses and quotes', () => {
    const formulas = run(
        'V2_TABLES.flatMap(t => t.columns.filter(c => c.kind === "calc").map(c => [t.key + "." + c.id, c.formula()]))',
    );
    assert.ok(formulas.length > 20);
    for (const [name, f] of formulas) {
        let depth = 0;
        for (const ch of f) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            assert.ok(depth >= 0, `${name}: extra ")"`);
        }
        assert.equal(depth, 0, `${name}: unbalanced parentheses`);
        assert.equal((f.match(/"/g) || []).length % 2, 0, `${name}: odd quotes`);
        assert.ok(f.startsWith('='), `${name}: must start with =`);
    }
});

test('formulas avoid locale-dependent TEXT format codes', () => {
    const formulas = run('V2_TABLES.flatMap(t => t.columns.filter(c => c.kind === "calc").map(c => c.formula()))');
    for (const f of formulas) {
        assert.ok(!/TEXT\([^)]*"(yyyy|0\.00)/.test(f), `locale-dependent TEXT in ${f}`);
    }
});

test('separator conversion handles arguments, array literals and strings', () => {
    assert.equal(
        run('v2ConvertSeparators(\'=IF(A1="a,b",SUM(1,2),{1,2;3,4})\', ";")'),
        '=IF(A1="a,b";SUM(1;2);{1\\2;3\\4})',
    );
    assert.equal(run('v2ConvertSeparators("=SUM(1,2)", ",")'), '=SUM(1,2)');
    const formulas = run(
        'V2_TABLES.flatMap(t => t.columns.filter(c => c.kind === "calc").map(c => v2ConvertSeparators(c.formula(), ";")))',
    );
    assert.ok(
        formulas.every(f => !/,(?=(?:[^"]*"[^"]*")*[^"]*$)/.test(f)),
        'comma left outside strings',
    );
});

test('column references resolve', () => {
    assert.equal(run("v2Col('charges', 'cle')"), 'F2:F');
    assert.equal(run("v2Ref('affectations', 'montant')"), "'Affectations'!$C$2:$C");
    assert.throws(() => run("v2Col('charges', 'nope')"));
});
