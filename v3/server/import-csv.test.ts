import { describe, expect, it } from 'vite-plus/test';

import { MAX_CSV_BYTES, parseImport } from './import-csv';

const categories = [
    { id: 'a', name: 'Appel' },
    { id: 'b', name: 'Fonds' },
    { id: 'c', name: 'Fonds; "A"' },
];
const parse = (csv: string) => parseImport(csv, categories);

describe('analyse CSV', () => {
    it('accepte les en-têtes français, les guillemets, les dates et montants français', () => {
        expect(
            parse('\uFEFFdate;libellé;crédit;débit\r\n31/01/2026;"Fonds; ""A""";;12,34\r\n'),
        ).toEqual({
            rows: [
                { row: 2, kind: 'charge', date: '2026-01-31', title: 'Fonds; "A"', category: 'Fonds; "A"', categoryId: 'c', amount: 1234 },
            ],
            errors: [],
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
            { row: 2, kind: 'charge', date: '2026-01-01', title: 'Fonds', category: 'Fonds', categoryId: 'b', amount: 1000 },
            { row: 3, kind: 'payment', date: '2026-01-02', label: 'Règlement', category: 'Paiement importé', amount: 500 },
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

    it('reconnaît les remboursements et exige une catégorie exacte sans enlever ses accents', () => {
        expect(parse('date;label;credit;debit\n2026-01-01; APPEL ;0;-10,25').rows[0]).toMatchObject({
            kind: 'refund',
            categoryId: 'a',
            amount: 1025,
        });
        for (const label of ['', 'Inconnu', 'Fonds supplément']) {
            expect(parse(`date;label;credit;debit\n2026-01-01;${label};;1`).errors[0].column).toBe('libellé');
        }
        expect(parseImport('date;label;credit;debit\n2026-01-01;appel;;1', [
            ...categories,
            { id: 'd', name: ' APPEL ' },
        ]).errors[0].message).toContain('Plusieurs');
        expect(parseImport('date;label;credit;debit\n2026-01-01;Reserve;;1', [
            { id: 'e', name: 'Réserve' },
        ]).errors[0].column).toBe('libellé');
        expect(parse('date;label;credit;debit\n2026-01-01;;1;').rows[0]).toMatchObject({ label: null });
    });

    it('accepte les colonnes bilingues réordonnées et refuse les anciens formats', () => {
        expect(parse(' DéBiT ;LiBeLlé; DATE ;CRÉDIT\n1;Appel;2026-01-01;').errors).toEqual([]);
        for (const header of ['date,label,type,amount', 'date,label,type,credit,debit', 'date,label,credit,debit,amount', 'date,label,libellé,debit'])
            expect(parse(`${header}\n2026-01-01,X,1,2`).errors[0].column).toBe('en-tête');
    });
});
