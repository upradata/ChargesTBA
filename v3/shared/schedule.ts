export function splitCents(total: number, count: number): number[] {
    if (!Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(count) || count < 1 || count > total) {
        throw new Error('Montant ou nombre d’échéances invalide');
    }
    const base = Math.floor(total / count);
    return Array.from({ length: count }, (_, index) => base + (index < total % count ? 1 : 0));
}

export function addMonths(iso: string, months: number): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) throw new Error('Date invalide');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const original = new Date(Date.UTC(year, month - 1, day));
    if (original.getUTCFullYear() !== year || original.getUTCMonth() !== month - 1 || original.getUTCDate() !== day) {
        throw new Error('Date invalide');
    }

    const first = new Date(Date.UTC(year, month - 1 + months, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, last));
    return first.toISOString().slice(0, 10);
}

export type ScheduleRule = { monthOffset: number; day: number; weight: number };
export type Installment = { date: string; amount: number };

export function remainingChargeAmount(amount: number, paid: number, refunded: number): number {
    return Math.max(0, amount - paid - refunded);
}

export function displayDate(date: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

export function remainingInstallments(schedule: Installment[], paid: number): Installment[] {
    let remainingPaid = paid;
    return schedule.map(item => {
        const applied = Math.min(remainingPaid, item.amount);
        remainingPaid -= applied;
        return { date: item.date, amount: item.amount - applied };
    });
}

export function makeSchedule(date: string, total: number, rules: ScheduleRule[]): Installment[] {
    addMonths(date, 0);
    if (
        !rules.length
        || rules.length > 120
        || rules.some(
            rule =>
                !Number.isInteger(rule.monthOffset)
                || rule.monthOffset < 0
                || rule.monthOffset > 120
                || !Number.isInteger(rule.day)
                || rule.day < 1
                || rule.day > 31
                || !Number.isInteger(rule.weight)
                || rule.weight < 1
                || rule.weight > 10000,
        )
        || total < rules.length
        || !Number.isSafeInteger(total)
    ) {
        throw new Error('Échéancier invalide');
    }
    const weightTotal = rules.reduce((sum, rule) => sum + rule.weight, 0);
    const shares = rules.map((rule, index) => {
        const exact = (total * rule.weight) / weightTotal;
        return { index, amount: Math.floor(exact), fraction: exact - Math.floor(exact) };
    });
    let remaining = total - shares.reduce((sum, share) => sum + share.amount, 0);
    for (const share of [...shares].sort((a, b) => b.fraction - a.fraction || a.index - b.index)) {
        if (remaining-- <= 0) break;
        share.amount++;
    }
    if (shares.some(share => share.amount < 1)) throw new Error('Montant trop faible pour cet échéancier');
    return rules
        .map((rule, index) => {
            const month = addMonths(date.slice(0, 8) + '01', rule.monthOffset);
            const first = new Date(`${month}T00:00:00Z`);
            const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
            return {
                date: month.slice(0, 8) + String(Math.min(rule.day, last)).padStart(2, '0'),
                amount: shares[index].amount,
            };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
}
