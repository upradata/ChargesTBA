/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */

type V2RefInput = {
    today: string; // ISO date
    charges: { date: string; montant: number }[];
    payments: { montant: number }[];
    allocations: { payment: number; charge: number; montant: number }[];
    installments: { charge: number; date: string; montant: number }[];
};

type V2RefResult = {
    charges: { paye: number; reste: number; solde: number; objectif: number; retard: number }[];
    payments: { affecte: number; nonAlloue: number }[];
};

const v2Round2 = (n: number): number => Math.round(n * 100) / 100;

/** Pure reference implementation of the sheet formulas, used to cross-check the live computations. */
function v2Reference(input: V2RefInput): V2RefResult {
    const paid = input.charges.map(() => 0);
    const allocated = input.payments.map(() => 0);
    input.allocations.forEach(a => {
        if (paid[a.charge] !== undefined) paid[a.charge] += a.montant;
        if (allocated[a.payment] !== undefined) allocated[a.payment] += a.montant;
    });
    return {
        charges: input.charges.map((c, i) => {
            const own = input.installments.filter(s => s.charge === i);
            const objectif =
                own.length === 0
                    ? c.date <= input.today
                        ? c.montant
                        : 0
                    : Math.min(
                          c.montant,
                          own.filter(s => s.date <= input.today).reduce((sum, s) => sum + s.montant, 0),
                      );
            return {
                paye: v2Round2(paid[i]),
                reste: v2Round2(c.montant - paid[i]),
                solde: v2Round2(paid[i] - c.montant),
                objectif: v2Round2(objectif),
                retard: v2Round2(Math.max(0, objectif - paid[i])),
            };
        }),
        payments: input.payments.map((p, i) => ({
            affecte: v2Round2(allocated[i]),
            nonAlloue: v2Round2(p.montant - allocated[i]),
        })),
    };
}

/** Reads the live sheets, recomputes everything in script and returns human-readable mismatches. */
function v2SelfCheck(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): string[] {
    const read = (key: V2TableKey): unknown[][] => {
        const sheet = v2Sheet(ss, key);
        return sheet.getRange(2, 1, V2_MAX_ROWS - 1, v2Table(key).columns.length).getValues();
    };
    const num = (v: unknown): number => (v2IsBlank(v) ? 0 : Number(v));
    const chargeRows = read('charges').filter(r => !v2IsBlank(r[v2ColIndex('charges', 'cle') - 1]));
    const paymentRows = read('paiements').filter(r => !v2IsBlank(r[v2ColIndex('paiements', 'cle') - 1]));
    const allocationRows = read('affectations').filter(r => !v2IsBlank(r[0]) || !v2IsBlank(r[1]));
    const scheduleRows = read('echeances').filter(r => !v2IsBlank(r[0]));

    const chargeKeys = chargeRows.map(r => String(r[v2ColIndex('charges', 'cle') - 1]));
    const paymentKeys = paymentRows.map(r => String(r[v2ColIndex('paiements', 'cle') - 1]));
    const problems: string[] = [];

    const input: V2RefInput = {
        today: v2ToIso(new Date()),
        charges: chargeRows.map(r => ({ date: v2ToIso(r[0]), montant: num(r[3]) })),
        payments: paymentRows.map(r => ({ montant: num(r[2]) })),
        allocations: [],
        installments: [],
    };
    allocationRows.forEach((r, n) => {
        const payment = paymentKeys.indexOf(v2ChargeKeyOf(String(r[0])));
        const charge = chargeKeys.indexOf(v2ChargeKeyOf(String(r[1])));
        if (payment < 0 || charge < 0) problems.push(`Affectations ligne ${n + 2} : paiement ou charge introuvable`);
        else input.allocations.push({ payment, charge, montant: num(r[2]) });
    });
    scheduleRows.forEach((r, n) => {
        const charge = chargeKeys.indexOf(String(r[0]));
        if (charge < 0) problems.push(`Échéances ligne ${n + 2} : charge introuvable`);
        else input.installments.push({ charge, date: v2ToIso(r[1]), montant: num(r[2]) });
    });

    const expected = v2Reference(input);
    const differs = (a: unknown, b: number): boolean => Math.abs(num(a) - b) > 0.005;
    expected.charges.forEach((e, i) => {
        const r = chargeRows[i];
        (['paye', 'reste', 'solde', 'objectif', 'retard'] as const).forEach(id => {
            const actual = r[v2ColIndex('charges', id) - 1];
            if (differs(actual, e[id]))
                problems.push(`Charge « ${chargeKeys[i]} » — ${id} : feuille=${String(actual)}, attendu=${e[id]}`);
        });
    });
    expected.payments.forEach((e, i) => {
        const r = paymentRows[i];
        (['affecte', 'nonAlloue'] as const).forEach(id => {
            const actual = r[v2ColIndex('paiements', id) - 1];
            if (differs(actual, e[id]))
                problems.push(`Paiement « ${paymentKeys[i]} » — ${id} : feuille=${String(actual)}, attendu=${e[id]}`);
        });
    });
    return problems;
}
