import type { ImportRow } from '../server/import-csv';
import type { ImportAllocation, ImportPreview, ImportTarget } from '../server/import-preview';

export type FundingRow = Exclude<ImportRow, { kind: 'charge' }>;

/** Server rows count the CSV header as line 1; users count data lines from 1. */
export function displayLine(row: number) {
    return row - 1;
}

export function allocatedTotal(allocations: ImportAllocation[]) {
    return allocations.reduce((sum, item) => sum + item.amount, 0);
}

/** Remaining capacity of each target once every other funding row's allocations are deducted. */
export function targetCapacities(preview: Pick<ImportPreview, 'targets' | 'proposals'>, fundingRow: number) {
    const capacity = new Map(preview.targets.map(target => [target.key, target.remaining]));
    for (const proposal of preview.proposals) {
        if (proposal.row === fundingRow) continue;
        for (const allocation of proposal.allocations)
            capacity.set(allocation.target, (capacity.get(allocation.target) ?? 0) - allocation.amount);
    }
    return capacity;
}

export function eligibleTargets(targets: ImportTarget[], funding: FundingRow) {
    const category = funding.category.trim().toLowerCase();
    return targets.filter(
        target =>
            target.date <= funding.date
            && (funding.kind !== 'refund' || target.category.trim().toLowerCase() === category),
    );
}

/** Targets shown in attribution mode: eligible, and either still owed or already chosen in the draft. */
export function visibleTargets(
    targets: ImportTarget[],
    funding: FundingRow,
    capacity: Map<string, number>,
    draft: ImportAllocation[],
) {
    return eligibleTargets(targets, funding).filter(
        target => (capacity.get(target.key) ?? 0) > 0 || draft.some(item => item.target === target.key),
    );
}

export function toggleAllocation(
    draft: ImportAllocation[],
    target: string,
    capacity: number,
    total: number,
): ImportAllocation[] {
    if (draft.some(item => item.target === target)) return draft.filter(item => item.target !== target);
    const amount = Math.min(total - allocatedTotal(draft), capacity);
    return amount > 0 ? [...draft, { target, amount }] : draft;
}

export function setAllocationAmount(
    draft: ImportAllocation[],
    target: string,
    amount: number,
    capacity: number,
    total: number,
): ImportAllocation[] {
    const others = allocatedTotal(draft.filter(item => item.target !== target));
    const clamped = Math.max(0, Math.min(Math.round(amount), capacity, total - others));
    return draft.map(item => (item.target === target ? { ...item, amount: clamped } : item));
}
