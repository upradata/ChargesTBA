/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */

const V2_COLORS = {
    inputHeader: '#1a73e8',
    calcHeader: '#5f6368',
    headerFont: '#ffffff',
    green: { bg: '#d9ead3', fg: '#137333' },
    red: { bg: '#f4cccc', fg: '#a50e0e' },
    orange: { bg: '#fce8b2', fg: '#b45f06' },
    yellow: { bg: '#fff2cc', fg: '#7f6000' },
    blue: { bg: '#cfe2f3', fg: '#1155cc' },
};

type V2ColorName = 'green' | 'red' | 'orange' | 'yellow' | 'blue';

const V2_STATUS_RULES: [string, V2ColorName][] = [
    ['✔', 'green'],
    ['✖', 'red'],
    ['⚠', 'orange'],
    ['◐', 'yellow'],
    ['⏳', 'blue'],
    ['↩', 'blue'],
];

function v2Sheet(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, key: V2SheetKey): GoogleAppsScript.Spreadsheet.Sheet {
    const name = V2_SHEET_NAMES[key];
    return ss.getSheetByName(name) || ss.insertSheet(name);
}

function v2StatusRules(
    range: GoogleAppsScript.Spreadsheet.Range,
): GoogleAppsScript.Spreadsheet.ConditionalFormatRule[] {
    return V2_STATUS_RULES.map(([symbol, color]) =>
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextStartsWith(symbol)
            .setBackground(V2_COLORS[color].bg)
            .setFontColor(V2_COLORS[color].fg)
            .setRanges([range])
            .build(),
    );
}

function v2SignRules(
    range: GoogleAppsScript.Spreadsheet.Range,
    positive: V2ColorName | null,
    negative: V2ColorName | null,
): GoogleAppsScript.Spreadsheet.ConditionalFormatRule[] {
    const rules: GoogleAppsScript.Spreadsheet.ConditionalFormatRule[] = [];
    if (positive)
        rules.push(
            SpreadsheetApp.newConditionalFormatRule()
                .whenNumberGreaterThan(0)
                .setFontColor(V2_COLORS[positive].fg)
                .setBackground(V2_COLORS[positive].bg)
                .setRanges([range])
                .build(),
        );
    if (negative)
        rules.push(
            SpreadsheetApp.newConditionalFormatRule()
                .whenNumberLessThan(0)
                .setFontColor(V2_COLORS[negative].fg)
                .setBackground(V2_COLORS[negative].bg)
                .setRanges([range])
                .build(),
        );
    return rules;
}

function v2ListValidation(source: GoogleAppsScript.Spreadsheet.Range): GoogleAppsScript.Spreadsheet.DataValidation {
    // Warning mode: settled items stay selectable and existing rows never show red invalid markers.
    return SpreadsheetApp.newDataValidation().requireValueInRange(source, true).setAllowInvalid(true).build();
}

function v2InstallParams(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
    const sheet = v2Sheet(ss, 'params');
    sheet.getRange('C1:E').clear();
    sheet
        .getRange('A1:E1')
        .setValues([
            ['Types de paiement', 'Catégories', 'Liste des charges', 'Liste des paiements', 'Filtre catégorie'],
        ]);
    if (sheet.getRange('A2').isBlank() && sheet.getRange('B2').isBlank()) {
        sheet.getRange(2, 1, V2_DEFAULT_TYPES.length, 1).setValues(V2_DEFAULT_TYPES.map(t => [t]));
        sheet.getRange(2, 2, V2_DEFAULT_CATEGORIES.length, 1).setValues(V2_DEFAULT_CATEGORIES.map(c => [c]));
    }
    const chargeKeys = v2Ref('charges', 'cle');
    const chargeRest = v2Ref('charges', 'reste');
    const paymentKeys = v2Ref('paiements', 'cle');
    const paymentRest = v2Ref('paiements', 'nonAlloue');
    // Keys start with an ISO date, so a text sort is chronological. Open items first, settled ones last.
    sheet
        .getRange('C2')
        .setFormula(
            `=IFERROR(LET(k,${chargeKeys},r,${chargeRest},a,IFERROR(SORT(FILTER(k,k<>"",r>0)),""),b,IFERROR(SORT(FILTER(k,k<>"",r<=0)),""),x,{a;b},FILTER(x,x<>"")),"")`,
        );
    sheet
        .getRange('D2')
        .setFormula(
            `=IFERROR(LET(k,${paymentKeys},r,${paymentRest},a,IFERROR(SORT(FILTER(k,k<>"",r<>0)),""),b,IFERROR(SORT(FILTER(k,k<>"",r=0)),""),x,{a;b},FILTER(x,x<>"")),"")`,
        );
    sheet.getRange('E2').setFormula(`=LET(c,B2:B100,{"${V2_ALL_CATEGORIES}";FILTER(c,c<>"")})`);
    sheet
        .getRange('A1:E1')
        .setFontWeight('bold')
        .setBackground(V2_COLORS.calcHeader)
        .setFontColor(V2_COLORS.headerFont);
    sheet.getRange('A1').setNote('Modifiable : ajoutez ou changez les types proposés.');
    sheet.getRange('B1').setNote('Modifiable : ajoutez ou changez les catégories proposées.');
    sheet.getRange('C1').setNote('Calculé : alimente la liste déroulante des charges (restant à payer d’abord).');
    sheet.getRange('D1').setNote('Calculé : alimente la liste déroulante des paiements (à répartir d’abord).');
    sheet.setColumnWidths(1, 2, 160);
    sheet.setColumnWidths(3, 2, 320);
    sheet.setColumnWidth(5, 160);
    sheet.setFrozenRows(1);
    sheet.setTabColor('#9aa0a6');
}

function v2InstallTable(
    ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
    def: V2TableDef,
): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = v2Sheet(ss, def.key);
    const cols = def.columns;
    const maxRows = sheet.getMaxRows();
    if (maxRows < V2_MAX_ROWS) sheet.insertRowsAfter(maxRows, V2_MAX_ROWS - maxRows);

    // Replace only our own protections so reinstalling never stacks duplicates.
    sheet
        .getProtections(SpreadsheetApp.ProtectionType.RANGE)
        .filter(p => p.getDescription() === 'Colonne calculée')
        .forEach(p => p.remove());

    cols.forEach((col, i) => {
        const n = i + 1;
        const header = sheet.getRange(1, n);
        header
            .setValue(col.header)
            .setNote(`${col.kind === 'input' ? 'À saisir' : 'Calculé (ne pas modifier)'} — ${col.note}`)
            .setFontWeight('bold')
            .setFontColor(V2_COLORS.headerFont)
            .setBackground(col.kind === 'input' ? V2_COLORS.inputHeader : V2_COLORS.calcHeader)
            .setWrap(true)
            .setVerticalAlignment('middle');
        sheet.setColumnWidth(n, col.width);
        const body = sheet.getRange(2, n, V2_MAX_ROWS - 1, 1);
        if (col.format) body.setNumberFormat(col.format);
        if (col.kind === 'calc') {
            sheet.getRange(3, n, V2_MAX_ROWS - 2, 1).clearContent(); // free the cells the array formula spills into
            sheet.getRange(2, n).setFormula(col.formula ? col.formula() : '');
            body.setBackground('#f8f9fa');
            body.protect().setWarningOnly(true).setDescription('Colonne calculée');
        }
    });
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 36);
    sheet.setTabColor(cols.some(c => c.kind === 'input') ? V2_COLORS.inputHeader : V2_COLORS.calcHeader);
    return sheet;
}

function v2InstallValidations(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
    const params = v2Sheet(ss, 'params');
    const chargeList = params.getRange(V2_PARAMS_RANGES.chargeList);
    const paymentList = params.getRange(V2_PARAMS_RANGES.paymentList);
    const types = params.getRange(V2_PARAMS_RANGES.types);
    const categories = params.getRange(V2_PARAMS_RANGES.categories);
    const body = (key: V2TableKey, id: string) => v2Sheet(ss, key).getRange(2, v2ColIndex(key, id), V2_MAX_ROWS - 1, 1);
    const dateRule = SpreadsheetApp.newDataValidation()
        .requireDate()
        .setAllowInvalid(false)
        .setHelpText('Saisissez une date valide (jj/mm/aaaa).')
        .build();
    const numberRule = SpreadsheetApp.newDataValidation()
        .requireNumberBetween(-10000000, 10000000)
        .setAllowInvalid(false)
        .setHelpText('Saisissez un montant en euros.')
        .build();
    const positiveRule = SpreadsheetApp.newDataValidation()
        .requireNumberGreaterThan(0)
        .setAllowInvalid(false)
        .setHelpText('Le montant dû doit être strictement positif.')
        .build();

    body('paiements', 'date').setDataValidation(dateRule);
    body('paiements', 'montant').setDataValidation(numberRule);
    body('paiements', 'type').setDataValidation(v2ListValidation(types));
    body('charges', 'date').setDataValidation(dateRule);
    body('charges', 'montant').setDataValidation(positiveRule);
    body('charges', 'categorie').setDataValidation(v2ListValidation(categories));
    body('affectations', 'paiement').setDataValidation(v2ListValidation(paymentList));
    body('affectations', 'charge').setDataValidation(v2ListValidation(chargeList));
    body('affectations', 'montant').setDataValidation(numberRule);
    body('echeances', 'charge').setDataValidation(v2ListValidation(chargeList));
    body('echeances', 'date').setDataValidation(dateRule);
    body('echeances', 'montant').setDataValidation(numberRule);
}

function v2InstallFormatting(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
    const body = (key: V2TableKey | V2SheetKey, id: string, table?: V2TableKey) => {
        const t = table || (key as V2TableKey);
        return v2Sheet(ss, key as V2SheetKey).getRange(2, v2ColIndex(t, id), V2_MAX_ROWS - 1, 1);
    };
    const plan: [V2SheetKey, GoogleAppsScript.Spreadsheet.ConditionalFormatRule[]][] = [
        [
            'paiements',
            [
                ...v2StatusRules(body('paiements', 'statut')),
                ...v2SignRules(body('paiements', 'nonAlloue'), 'orange', 'red'),
                ...v2SignRules(body('paiements', 'montant'), null, 'blue'),
            ],
        ],
        [
            'charges',
            [
                ...v2StatusRules(body('charges', 'statut')),
                ...v2SignRules(body('charges', 'solde'), 'green', 'red'),
                ...v2SignRules(body('charges', 'retard'), 'red', null),
                ...v2SignRules(body('charges', 'reste'), null, 'blue'),
            ],
        ],
        [
            'affectations',
            [
                ...v2StatusRules(body('affectations', 'controle')),
                ...v2SignRules(body('affectations', 'montant'), null, 'blue'),
            ],
        ],
        ['echeances', [...v2StatusRules(body('echeances', 'statut')), ...v2StatusRules(body('echeances', 'controle'))]],
    ];
    plan.forEach(([key, rules]) => v2Sheet(ss, key).setConditionalFormatRules(rules));
}

function v2InstallViews(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
    const charge = (id: string) => v2Ref('charges', id);
    const byCharge = v2Sheet(ss, 'vueCharge');
    byCharge.clear();
    byCharge
        .getRange('A1:H1')
        .setValues([['Catégorie', 'Libellé', 'Montant dû', 'Payé', 'Reste', 'Solde', 'Retard', 'Statut']]);
    byCharge
        .getRange('A2')
        .setFormula(
            `=IFERROR(SORT(FILTER({${['categorie', 'libelle', 'montant', 'paye', 'reste', 'solde', 'retard', 'statut'].map(charge).join(',')}},${charge('cle')}<>""),7,FALSE,5,FALSE),"")`,
        );
    byCharge.getRange('J1:N1').setValues([['Catégorie', 'Dû', 'Payé', 'Reste', 'Retard']]);
    byCharge
        .getRange('J2')
        .setFormula(
            `=IFERROR(LET(u,UNIQUE(FILTER(${charge('categorie')},${charge('cle')}<>"")),HSTACK(u,`
                + ['montant', 'paye', 'reste', 'retard']
                    .map(id => `MAP(u,LAMBDA(c,SUMIFS(${charge(id)},${charge('categorie')},c)))`)
                    .join(',')
                + `)),"")`,
        );
    byCharge
        .getRange('A1:H1')
        .setFontWeight('bold')
        .setBackground(V2_COLORS.calcHeader)
        .setFontColor(V2_COLORS.headerFont);
    byCharge
        .getRange('J1:N1')
        .setFontWeight('bold')
        .setBackground(V2_COLORS.calcHeader)
        .setFontColor(V2_COLORS.headerFont);
    byCharge.getRange('C2:E' + V2_MAX_ROWS).setNumberFormat(V2_FORMATS.eur);
    byCharge.getRange('F2:F' + V2_MAX_ROWS).setNumberFormat(V2_FORMATS.signed);
    byCharge.getRange('G2:G' + V2_MAX_ROWS).setNumberFormat(V2_FORMATS.eur);
    byCharge.getRange('K2:N' + V2_MAX_ROWS).setNumberFormat(V2_FORMATS.eur);
    byCharge.setColumnWidths(1, 1, 140);
    byCharge.setColumnWidth(2, 240);
    byCharge.setColumnWidths(3, 5, 110);
    byCharge.setColumnWidth(8, 150);
    byCharge.setColumnWidth(9, 30);
    byCharge.setColumnWidths(10, 5, 120);
    byCharge.setFrozenRows(1);
    byCharge.setConditionalFormatRules([
        ...v2StatusRules(byCharge.getRange('H2:H' + V2_MAX_ROWS)),
        ...v2SignRules(byCharge.getRange('F2:F' + V2_MAX_ROWS), 'green', 'red'),
        ...v2SignRules(byCharge.getRange('G2:G' + V2_MAX_ROWS), 'red', null),
    ]);
    byCharge.setTabColor('#34a853');

    const timeline = v2Sheet(ss, 'vueTemps');
    timeline.clear();
    timeline.getCharts().forEach(c => timeline.removeChart(c));
    timeline.getRange('A1:E1').setValues([['Date', 'Nature', 'Libellé', 'Mouvement', 'Solde cumulé']]);
    const chargeDate = `FILTER(${charge('date')},${charge('cle')}<>"")`;
    const chargeLabel = `FILTER(${charge('libelle')},${charge('cle')}<>"")`;
    const chargeAmount = `FILTER(${charge('montant')},${charge('cle')}<>"")`;
    const pay = (id: string) => v2Ref('paiements', id);
    const payFilter = (id: string) => `FILTER(${pay(id)},${pay('cle')}<>"")`;
    timeline
        .getRange('A2')
        .setFormula(
            `=IFERROR(LET(cd,${chargeDate},pd,${payFilter('date')},`
                + `ev,SORT({cd,ARRAYFORMULA(IF(cd<>"","Charge","")),${chargeLabel},-${chargeAmount};`
                + `pd,ARRAYFORMULA(IF(pd<>"","Paiement","")),${payFilter('type')},${payFilter('montant')}},1,TRUE),`
                + `HSTACK(ev,SCAN(0,INDEX(ev,0,4),LAMBDA(a,v,a+N(v))))),"")`,
        );
    timeline
        .getRange('A1:E1')
        .setFontWeight('bold')
        .setBackground(V2_COLORS.calcHeader)
        .setFontColor(V2_COLORS.headerFont);
    timeline.getRange('A2:A' + V2_MAX_ROWS).setNumberFormat(V2_FORMATS.date);
    timeline.getRange('D2:D' + V2_MAX_ROWS).setNumberFormat(V2_FORMATS.signed);
    timeline.getRange('E2:E' + V2_MAX_ROWS).setNumberFormat(V2_FORMATS.signed);
    timeline.setColumnWidths(1, 2, 110);
    timeline.setColumnWidth(3, 260);
    timeline.setColumnWidths(4, 2, 130);
    timeline.setFrozenRows(1);
    timeline.setConditionalFormatRules([...v2SignRules(timeline.getRange('D2:E' + V2_MAX_ROWS), 'green', 'red')]);
    timeline.insertChart(
        timeline
            .newChart()
            .setChartType(Charts.ChartType.LINE)
            .addRange(timeline.getRange('A1:A300'))
            .addRange(timeline.getRange('E1:E300'))
            .setOption('title', 'Solde cumulé (paiements − charges)')
            .setOption('legend', { position: 'none' })
            .setPosition(2, 7, 0, 0)
            .build(),
    );
    timeline.setTabColor('#34a853');
}

function v2InstallDashboard(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
    const sheet = v2Sheet(ss, 'bord');
    const existing = sheet.getRange('B14:B15').getFormulas();
    const keepCategory = String(sheet.getRange('B13').getValue() || V2_ALL_CATEGORIES);
    sheet.clear();
    sheet.clearConditionalFormatRules();
    const charge = (id: string) => v2Ref('charges', id);
    const pay = (id: string) => v2Ref('paiements', id);
    const alloc = (id: string) => v2Ref('affectations', id);
    const sched = (id: string) => v2Ref('echeances', id);

    sheet.getRange('A1').setValue('Charges de copropriété — Tableau de bord').setFontSize(16).setFontWeight('bold');
    sheet
        .getRange('A3:A9')
        .setValues([
            ['Total des charges dues'],
            ['Total payé (net des remboursements)'],
            ['Solde global (payé − dû)'],
            ['Retard à ce jour'],
            ['Paiements non répartis'],
            ['Charges en retard'],
            ['Charges restant à payer'],
        ]);
    sheet
        .getRange('B3:B9')
        .setFormulas([
            [`=SUM(${charge('montant')})`],
            [`=SUM(${pay('montant')})`],
            ['=B4-B3'],
            [`=SUM(${charge('retard')})`],
            [`=SUM(${pay('nonAlloue')})`],
            [`=COUNTIF(${charge('statut')},"⚠*")`],
            [`=COUNTIFS(${charge('reste')},">0")`],
        ]);
    sheet.getRange('B3:B7').setNumberFormat(V2_FORMATS.eur);
    sheet.getRange('B5').setNumberFormat(V2_FORMATS.signed);

    sheet.getRange('A12').setValue('Objectif vs réalisé sur une période').setFontWeight('bold').setFontSize(12);
    sheet
        .getRange('A13:A19')
        .setValues([
            ['Catégorie'],
            ['Début de période'],
            ['Fin de période'],
            ['Objectif de la période'],
            ['Réalisé sur la période'],
            ['Écart (réalisé − objectif)'],
            ['Atteinte de l’objectif'],
        ]);
    sheet.getRange('B13').setValue(keepCategory).setBackground('#e8f0fe');
    sheet
        .getRange('B13')
        .setDataValidation(
            SpreadsheetApp.newDataValidation()
                .requireValueInRange(v2Sheet(ss, 'params').getRange(V2_PARAMS_RANGES.categoryFilter), true)
                .setAllowInvalid(true)
                .build(),
        );
    // Defaults to the current quarter; overwrite the cells to look at another period.
    sheet
        .getRange('B14')
        .setFormula(existing[0][0] || '=DATE(YEAR(TODAY()),FLOOR((MONTH(TODAY())-1)/3)*3+1,1)')
        .setBackground('#e8f0fe');
    sheet
        .getRange('B15')
        .setFormula(existing[1][0] || '=EDATE(B14,3)-1')
        .setBackground('#e8f0fe');
    sheet.getRange('B14:B15').setNumberFormat(V2_FORMATS.date);
    const crit = `IF($B$13="${V2_ALL_CATEGORIES}","*",$B$13)`;
    sheet
        .getRange('B16')
        .setFormula(
            `=SUMIFS(${sched('montant')},${sched('date')},">="&$B$14,${sched('date')},"<="&$B$15,${sched('categorie')},${crit})`
                + `+SUM(MAP(${charge('cle')},${charge('date')},${charge('categorie')},${charge('montant')},LAMBDA(k,d,c,m,`
                + `IF(k="",0,IF(AND(COUNTIF(${sched('charge')},k)=0,d>=$B$14,d<=$B$15,OR($B$13="${V2_ALL_CATEGORIES}",c=$B$13)),m,0)))))`,
        );
    sheet
        .getRange('B17')
        .setFormula(
            `=SUMIFS(${alloc('montant')},${alloc('datePaiement')},">="&$B$14,${alloc('datePaiement')},"<="&$B$15,${alloc('categorie')},${crit})`,
        );
    sheet.getRange('B18').setFormula('=B17-B16');
    sheet.getRange('B19').setFormula('=IF(B16=0,"",B17/B16)').setNumberFormat('0%');
    sheet.getRange('B16:B17').setNumberFormat(V2_FORMATS.eur);
    sheet.getRange('B18').setNumberFormat(V2_FORMATS.signed);

    sheet.getRange('A22').setValue('Légende').setFontWeight('bold').setFontSize(12);
    sheet.getRange('A23:B28').setValues([
        ['✔', 'Soldé / réparti / réalisé'],
        ['⏳', 'À payer, à répartir ou à venir'],
        ['◐', 'Partiellement payé'],
        ['⚠', 'En retard ou à vérifier'],
        ['✖', 'Erreur à corriger'],
        ['↩', 'Trop-perçu (à rembourser ou reporter)'],
    ]);
    sheet.getRange('A30').setValue('Mode d’emploi').setFontWeight('bold').setFontSize(12);
    sheet
        .getRange('A31:A35')
        .setValues([
            ['1. Paiements : ajoutez une ligne par paiement (négatif = remboursement du syndic).'],
            ['2. Charges : ajoutez chaque charge à payer. Menu « Charges TBA » pour créer un échéancier.'],
            ['3. Affectations : choisissez le paiement et la charge dans les listes, puis le montant.'],
            ['4. Colonnes grises = calculées automatiquement, ne pas les modifier.'],
            ['5. Le menu « Charges TBA » propose aussi un contrôle de cohérence.'],
        ]);
    sheet.setColumnWidth(1, 300);
    sheet.setColumnWidth(2, 200);
    sheet.getRange('A3:A9').setFontWeight('bold');
    sheet.getRange('A13:A19').setFontWeight('bold');
    sheet.getRange('B3:B19').setHorizontalAlignment('right');
    sheet.getRange('A23:A28').setHorizontalAlignment('center').setFontSize(14);
    sheet.setConditionalFormatRules([
        ...v2SignRules(sheet.getRange('B5'), 'green', 'red'),
        ...v2SignRules(sheet.getRange('B18'), 'green', 'red'),
        ...v2SignRules(sheet.getRange('B6'), 'red', null),
        ...v2SignRules(sheet.getRange('B7'), 'orange', 'red'),
        ...v2SignRules(sheet.getRange('B8'), 'red', null),
    ]);
    sheet.setTabColor('#fbbc04');
    sheet.setHiddenGridlines(true);
}

/** Idempotent: creates or refreshes all tabs, formulas, validations and formatting. Input data is never touched. */
function v2Install(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
    v2InstallParams(ss);
    V2_TABLES.forEach(def => v2InstallTable(ss, def));
    v2InstallValidations(ss);
    v2InstallFormatting(ss);
    v2InstallViews(ss);
    v2InstallDashboard(ss);
    const order: V2SheetKey[] = [
        'bord',
        'paiements',
        'charges',
        'affectations',
        'echeances',
        'vueCharge',
        'vueTemps',
        'params',
    ];
    order.forEach((key, i) => {
        ss.setActiveSheet(v2Sheet(ss, key));
        ss.moveActiveSheet(i + 1);
    });
    ss.getSheets()
        .filter(s => /^(Sheet1|Feuille 1)$/.test(s.getName()) && s.getLastRow() === 0)
        .forEach(s => ss.deleteSheet(s));
    ss.setActiveSheet(v2Sheet(ss, 'bord'));
}
