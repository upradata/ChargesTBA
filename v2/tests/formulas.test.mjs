import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../dist/Schema.js', import.meta.url), 'utf8'), ctx);

// A "." decimal is a parse error in comma-decimal locales (e.g. French), and v2ConvertSeparators does not fix it.
test('calculated formulas contain no dot-decimal literal outside strings', () => {
    const formulas = JSON.parse(
        vm.runInContext(
            `JSON.stringify(V2_TABLES.flatMap(t => t.columns.filter(c => c.formula).map(c => [t.key + '.' + c.id, c.formula()])))`,
            ctx,
        ),
    );
    const offenders = formulas.filter(([, f]) => /\d\.\d/.test(f.replace(/"[^"]*"/g, '""'))).map(([id]) => id);
    assert.deepEqual(offenders, []);
});
