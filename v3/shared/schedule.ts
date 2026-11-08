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
