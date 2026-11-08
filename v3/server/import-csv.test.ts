import { describe, expect, it } from 'vite-plus/test';

import { MAX_CSV_BYTES, parseImport } from './import-csv';

describe('analyse CSV', () => {
    it('accepte les en-têtes français, les guillemets, les dates et montants français', () => {
        expect(
            parseImport('charges', '\uFEFFdate;libellé;type;montant\r\n31/01/2026;"Fonds; ""A""";Appel;12,34\r\n'),
        ).toEqual({
            rows: [
                { row: 2, kind: 'charge', date: '2026-01-31', title: 'Fonds; "A"', category: 'Appel', amount: 1234 },
            ],
            errors: [],
        });
        expect(parseImport('payments', 'date,type,amount,label\n2026-02-01,Virement,12.30,Test').rows).toEqual([
            { row: 2, kind: 'payment', date: '2026-02-01', category: 'Virement', amount: 1230, label: 'Test' },
        ]);
    });

    it('convertit les deux sens du solde et rejette les côtés invalides', () => {
        const result = parseImport(
            'solde',
            [
                'date;label;type;crédit;débit',
                '2026-01-01;Appel;Fonds;;10,00',
                '02/01/2026;Règlement;Virement;5,00;',
                '2026-01-03;Deux;X;1;2',
                '2026-01-04;Vide;X;;',
                '2026-01-05;Négatif;X;-1;',
            ].join('\n'),
        );
        expect(result.rows).toEqual([
            { row: 2, kind: 'charge', date: '2026-01-01', title: 'Appel', category: 'Fonds', amount: 1000 },
            { row: 3, kind: 'payment', date: '2026-01-02', label: 'Règlement', category: 'Virement', amount: 500 },
        ]);
        expect(result.errors.map(error => error.row)).toEqual([4, 5, 6]);
    });

    it('rejette dates, montants, colonnes et syntaxe invalides', () => {
        expect(parseImport('charges', 'date,label,type,amount\n2026-02-30,X,Y,1.001').errors).toHaveLength(2);
        expect(parseImport('charges', 'date,label,type,amount\n2026-01-01,X,Y,0').errors).toHaveLength(1);
        expect(parseImport('charges', 'date,label,type,amount\n2026-01-01,X,Y,1000000.01').errors).toHaveLength(1);
        expect(parseImport('charges', 'date,label,type,amount\n2026-01-01,"X,Y,1').errors[0].column).toBe('fichier');
        expect(parseImport('charges', 'date,label,type\n2026-01-01,X,Y').errors[0].column).toBe('en-tête');
        expect(parseImport('payments', 'date,type,amount\n2026-01-01,Virement,1,20').errors[0].column).toBe('ligne');
        expect(parseImport('payments', 'date,type,amount\n2026-01-01,Virement,1\n'.repeat(1002)).errors[0].column).toBe(
            'fichier',
        );
        expect(parseImport('payments', 'x'.repeat(MAX_CSV_BYTES + 1)).errors[0].column).toBe('fichier');
    });
});
