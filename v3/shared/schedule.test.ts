import { describe, expect, it } from 'vite-plus/test';

import { addMonths, makeSchedule, remainingChargeAmount, remainingInstallments, splitCents } from './schedule';

describe('échéancier', () => {
    it('répartit les centimes sans perte', () => {
        expect(splitCents(1000, 3)).toEqual([334, 333, 333]);
    });
    it('déduit séparément paiements et remboursements du solde restant', () => {
        expect(remainingChargeAmount(1000, 300, 200)).toBe(500);
        expect(remainingChargeAmount(1000, 800, 400)).toBe(0);
    });
    it('conserve le jour demandé et borne la fin du mois', () => {
        expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
        expect(addMonths('2024-01-31', 2)).toBe('2024-03-31');
    });
    it('rejette les dates et montants invalides', () => {
        expect(() => addMonths('2024-02-30', 1)).toThrow();
        expect(() => splitCents(2, 3)).toThrow();
    });
    it('crée les trois premiers jours des mois suivants et répartit les centimes', () => {
        expect(
            makeSchedule(
                '2026-12-31',
                1000,
                [1, 2, 3].map(monthOffset => ({
                    monthOffset,
                    day: 1,
                    weight: 1,
                })),
            ),
        ).toEqual([
            { date: '2027-01-01', amount: 334 },
            { date: '2027-02-01', amount: 333 },
            { date: '2027-03-01', amount: 333 },
        ]);
    });
    it('respecte les parts et borne les jours en fin de mois', () => {
        expect(
            makeSchedule('2024-01-12', 101, [
                { monthOffset: 2, day: 31, weight: 1 },
                { monthOffset: 1, day: 31, weight: 2 },
            ]),
        ).toEqual([
            { date: '2024-02-29', amount: 67 },
            { date: '2024-03-31', amount: 34 },
        ]);
        expect(() => makeSchedule('2024-02-30', 100, [{ monthOffset: 1, day: 1, weight: 1 }])).toThrow();
        expect(() =>
            makeSchedule('2024-02-01', 2, [
                { monthOffset: 1, day: 1, weight: 100 },
                { monthOffset: 2, day: 1, weight: 1 },
            ]),
        ).toThrow();
    });
    it('applique les paiements aux échéances chronologiques, y compris les montants inégaux', () => {
        const remaining = remainingInstallments(
            [
                { date: '2026-01-01', amount: 100 },
                { date: '2026-03-15', amount: 250 },
                { date: '2026-04-01', amount: 650 },
            ],
            175,
        );
        expect(remaining).toEqual([
            { date: '2026-01-01', amount: 0 },
            { date: '2026-03-15', amount: 175 },
            { date: '2026-04-01', amount: 650 },
        ]);
        expect(remaining.filter(item => item.date < '2026-04-01').reduce((sum, item) => sum + item.amount, 0)).toBe(
            175,
        );
    });
});
