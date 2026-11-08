import { describe, expect, it } from 'vite-plus/test';

import { addMonths, splitCents } from './schedule';

describe('échéancier', () => {
    it('répartit les centimes sans perte', () => {
        expect(splitCents(1000, 3)).toEqual([334, 333, 333]);
    });
    it('conserve le jour demandé et borne la fin du mois', () => {
        expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
        expect(addMonths('2024-01-31', 2)).toBe('2024-03-31');
    });
    it('rejette les dates et montants invalides', () => {
        expect(() => addMonths('2024-02-30', 1)).toThrow();
        expect(() => splitCents(2, 3)).toThrow();
    });
});
