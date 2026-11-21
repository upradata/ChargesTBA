import { describe, expect, it } from 'vite-plus/test';

import type { ImportTarget } from '../server/import-preview';

import {
    displayLine,
    setAllocationAmount,
    targetCapacities,
    toggleAllocation,
    visibleTargets,
    type FundingRow,
} from './importAttribution';

const target = (key: string, date: string, remaining: number, category = 'Appel'): ImportTarget => ({
    key,
    date,
    title: key,
    category,
    remaining,
});
const payment: FundingRow = {
    row: 5,
    kind: 'payment',
    date: '2026-02-01',
    label: 'Virement',
    category: 'Paiement importé',
    amount: 10000,
};

describe('import attribution', () => {
    it('numbers data lines from 1 without the CSV header', () => {
        expect(displayLine(2)).toBe(1);
    });

    it('hides future, fully paid and other-category targets but keeps those already chosen', () => {
        const targets = [
            target('charge:a', '2026-01-01', 3000),
            target('row:2', '2026-01-15', 5000),
            target('row:3', '2026-01-20', 2000),
            target('row:4', '2026-03-01', 1000),
            target('row:6', '2026-01-10', 1000, 'Travaux'),
        ];
        const capacity = targetCapacities(
            {
                targets,
                proposals: [
                    {
                        row: 7,
                        allocations: [
                            { target: 'row:2', amount: 5000 },
                            { target: 'row:3', amount: 2000 },
                        ],
                    },
                    { row: 5, allocations: [{ target: 'charge:a', amount: 3000 }] },
                ],
            },
            5,
        );
        expect(capacity.get('charge:a')).toBe(3000);
        expect(capacity.get('row:2')).toBe(0);
        const draft = [{ target: 'row:3', amount: 0 }];
        expect(visibleTargets(targets, payment, capacity, draft).map(item => item.key)).toEqual([
            'charge:a',
            'row:3',
            'row:6',
        ]);
        expect(
            visibleTargets(
                targets,
                { ...payment, kind: 'refund', title: 'Avoir', categoryId: 'a', category: 'appel' },
                capacity,
                [],
            ).map(item => item.key),
        ).toEqual(['charge:a']);
    });

    it('fills selections with what remains and refuses new ones once everything is attributed', () => {
        let draft = toggleAllocation([], 'row:2', 6000, 10000);
        draft = toggleAllocation(draft, 'row:3', 8000, 10000);
        expect(draft).toEqual([
            { target: 'row:2', amount: 6000 },
            { target: 'row:3', amount: 4000 },
        ]);
        expect(toggleAllocation(draft, 'row:4', 500, 10000)).toBe(draft);
        expect(toggleAllocation(draft, 'row:2', 6000, 10000)).toEqual([{ target: 'row:3', amount: 4000 }]);
    });

    it('clamps an edited amount to the charge and to the unattributed balance', () => {
        const draft = [
            { target: 'row:2', amount: 6000 },
            { target: 'row:3', amount: 1000 },
        ];
        expect(setAllocationAmount(draft, 'row:3', 9000, 8000, 10000)[1].amount).toBe(4000);
        expect(setAllocationAmount(draft, 'row:3', 9000, 2500, 10000)[1].amount).toBe(2500);
        expect(setAllocationAmount(draft, 'row:3', -5, 2500, 10000)[1].amount).toBe(0);
    });
});
