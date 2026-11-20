import { describe, expect, it } from 'vite-plus/test';

import { MAX_CSV_BYTES, parseImport, pendingCategoryId } from './import-csv';

const categories = [
    { id: 'a', name: 'Appel' },
    { id: 'b', name: 'Fonds' },
    { id: 'c', name: 'Fonds; "A"' },
];
const parse = (csv: string) => parseImport(csv, categories);

describe('analyse CSV', () => {
    it('accepte les en-têtes français, les guillemets, les dates et montants français', () => {
        expect(parse('\uFEFFdate;libellé;crédit;débit\r\n31/01/2026;"Fonds; ""A""";;12,34\r\n')).toEqual({
            rows: [
                {
                    row: 2,
                    kind: 'charge',
                    date: '2026-01-31',
                    title: 'Fonds; "A"',
                    category: 'Fonds; "A"',
                    categoryId: 'c',
                    amount: 1234,
                },
            ],
            errors: [],
            unresolvedCategories: [],
        });
        expect(parse('date,credit,debit,label\n2026-02-01,12.30,,Test').rows).toEqual([
            { row: 2, kind: 'payment', date: '2026-02-01', category: 'Paiement importé', amount: 1230, label: 'Test' },
        ]);
    });

    it('convertit les deux sens du solde et rejette les côtés invalides', () => {
        const result = parse(
            [
                'date;label;crédit;débit',
                '2026-01-01;Fonds;;10,00',
                '02/01/2026;Règlement;5,00;',
                '2026-01-03;Deux;1;2',
                '2026-01-04;Vide;;',
                '2026-01-05;Négatif;-1;',
            ].join('\n'),
        );
        expect(result.rows).toEqual([
            {
                row: 2,
                kind: 'charge',
                date: '2026-01-01',
                title: 'Fonds',
                category: 'Fonds',
                categoryId: 'b',
                amount: 1000,
            },
            {
                row: 3,
                kind: 'payment',
                date: '2026-01-02',
                label: 'Règlement',
                category: 'Paiement importé',
                amount: 500,
            },
        ]);
        expect(result.errors.map(error => error.row)).toEqual([4, 5, 6]);
    });

    it('rejette dates, montants, colonnes et syntaxe invalides', () => {
        expect(parse('date,label,credit,debit\n2026-02-30,Appel,,1.001').errors).toHaveLength(2);
        expect(parse('date,label,credit,debit\n2026-01-01,Appel,,0').errors).toHaveLength(1);
        expect(parse('date,label,credit,debit\n2026-01-01,Appel,,1000000.01').errors).toHaveLength(1);
        expect(parse('date,label,credit,debit\n2026-01-01,"X,,1').errors[0].column).toBe('fichier');
        expect(parse('date,label,credit\n2026-01-01,X,1').errors[0].column).toBe('en-tête');
        expect(parse('date,label,credit,debit\n2026-01-01,Virement,1,20,30').errors[0].column).toBe('ligne');
        expect(parse('date,label,credit,debit\n' + '2026-01-01,Virement,1,\n'.repeat(1001)).errors[0].column).toBe(
            'fichier',
        );
        expect(parse('x'.repeat(MAX_CSV_BYTES + 1)).errors[0].column).toBe('fichier');
    });

    it('reconnaît les remboursements et signale les libellés sans correspondance exacte', () => {
        expect(parse('date;label;credit;debit\n2026-01-01; APPEL ;0;-10,25').rows[0]).toMatchObject({
            kind: 'refund',
            categoryId: 'a',
            amount: 1025,
        });
        expect(parse('date;label;credit;debit\n2026-01-01;;;1').errors[0].column).toBe('libellé');
        expect(parse('date;label;credit;debit\n2026-01-01;Inconnu;;1').unresolvedCategories).toEqual([
            { label: 'Inconnu', rows: [2] },
        ]);
        expect(parse('date;label;credit;debit\n2026-01-01;Fonds supplément;;1').unresolvedCategories).toEqual([
            { label: 'Fonds supplément', rows: [2] },
        ]);
        expect(
            parseImport('date;label;credit;debit\n2026-01-01;appel;;1', [...categories, { id: 'd', name: ' APPEL ' }])
                .unresolvedCategories,
        ).toEqual([{ label: 'appel', rows: [2] }]);
        expect(
            parseImport('date;label;credit;debit\n2026-01-01;Reserve;;1', [{ id: 'e', name: 'Réserve' }])
                .unresolvedCategories,
        ).toEqual([{ label: 'Reserve', rows: [2] }]);
        expect(parse('date;label;credit;debit\n2026-01-01;;1;').rows[0]).toMatchObject({ label: null });
    });

    it('applique un choix de catégorie à chaque ligne du même libellé et permet une nouvelle catégorie', () => {
        const existing = parseImport(
            'date;label;credit;debit\n2026-01-01;Divers;;1\n2026-01-02; DIVERS ;;2',
            categories,
            [{ label: 'Divers', kind: 'existing', categoryId: 'b' }],
        );
        expect(existing.rows.map(row => (row.kind === 'payment' ? null : row.categoryId))).toEqual(['b', 'b']);
        expect(existing.unresolvedCategories).toEqual([]);

        const created = parseImport('date;label;credit;debit\n2026-01-01;Travaux;;1', categories, [
            { label: 'Travaux', kind: 'new', name: 'Travaux', defaultScheduleId: null },
        ]);
        expect(created.rows[0]).toMatchObject({
            kind: 'charge',
            category: 'Travaux',
            categoryId: pendingCategoryId('Travaux'),
        });
        expect(created.unresolvedCategories).toEqual([]);
    });

    it('accepte les colonnes bilingues réordonnées et refuse les anciens formats', () => {
        expect(parse(' DéBiT ;LiBeLlé; DATE ;CRÉDIT\n1;Appel;2026-01-01;').errors).toEqual([]);
        for (const header of [
            'date,label,type,amount',
            'date,label,type,credit,debit',
            'date,label,credit,debit,amount',
            'date,label,libellé,debit',
        ])
            expect(parse(`${header}\n2026-01-01,X,1,2`).errors[0].column).toBe('en-tête');
    });
});
