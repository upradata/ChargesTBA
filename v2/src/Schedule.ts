/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */

type V2Installment = { date: string; amount: number }; // date as ISO yyyy-mm-dd

function v2PadNumber(n: number, size: number): string {
    return ('0000' + n).slice(-size);
}

function v2ParseIsoDate(iso: string): { y: number; m: number; d: number } {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) throw new Error(`Date invalide : "${iso}" (format attendu aaaa-mm-jj)`);
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function v2FormatIsoDate(y: number, m: number, d: number): string {
    return `${v2PadNumber(y, 4)}-${v2PadNumber(m, 2)}-${v2PadNumber(d, 2)}`;
}

/** Adds months and clamps the day to the target month length (31 Jan + 1 month = 28/29 Feb). */
function v2AddMonths(iso: string, months: number): string {
    const { y, m, d } = v2ParseIsoDate(iso);
    const total = y * 12 + (m - 1) + months;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    return v2FormatIsoDate(ny, nm, Math.min(d, lastDay));
}

/** Splits an amount in cents into `count` parts; the first parts absorb the remainder so the sum is exact. */
function v2SplitAmount(total: number, count: number): number[] {
    if (!Number.isInteger(count) || count < 1) throw new Error('Le nombre d’échéances doit être un entier ≥ 1');
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / count);
    const remainder = cents - base * count;
    return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

/** Uniform schedule: `count` installments, one every `everyMonths` months starting at `startIso`. */
function v2GenerateSchedule(total: number, count: number, startIso: string, everyMonths: number): V2Installment[] {
    if (!Number.isInteger(everyMonths) || everyMonths < 1) throw new Error('La périodicité doit être un entier ≥ 1 mois');
    return v2SplitAmount(total, count).map((amount, i) => ({ date: v2AddMonths(startIso, i * everyMonths), amount }));
}

/** Custom calendar: a list of dates (comma, semicolon or newline separated) sharing the total uniformly. */
function v2GenerateCustomSchedule(total: number, datesText: string): V2Installment[] {
    const dates = datesText
        .split(/[\s,;]+/)
        .map(s => s.trim())
        .filter(Boolean);
    if (dates.length === 0) throw new Error('Aucune date fournie');
    dates.forEach(v2ParseIsoDate);
    const sorted = dates.slice().sort();
    return v2SplitAmount(total, sorted.length).map((amount, i) => ({ date: sorted[i], amount }));
}
