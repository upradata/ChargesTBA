/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */
// No top-level code may depend on another file: Apps Script loads files in an unspecified order.

const V2_MAX_ROWS = 1000;

const V2_SHEET_NAMES = {
    paiements: 'Paiements',
    charges: 'Charges',
    affectations: 'Affectations',
    echeances: 'Échéances',
    vueCharge: 'Vue par charge',
    vueTemps: 'Vue chronologique',
    bord: 'Tableau de bord',
    params: 'Paramètres',
} as const;

type V2SheetKey = keyof typeof V2_SHEET_NAMES;
type V2TableKey = 'paiements' | 'charges' | 'affectations' | 'echeances';

const V2_FORMATS = {
    date: 'dd/mm/yyyy',
    eur: '#,##0.00 "€";[Red]-#,##0.00 "€"',
    signed: '+#,##0.00 "€";-#,##0.00 "€";0.00 "€"',
};

// Statuses start with a symbol so that conditional formatting never relies on colour alone.
const V2_STATUS = {
    paymentDone: '✔ Réparti',
    paymentToAllocate: '⏳ À répartir',
    paymentOver: '✖ Sur-affecté',
    paymentMissingAmount: '⚠ Montant manquant',
    paymentDuplicate: '⚠ Doublon — ajoutez une Réf',
    chargeDone: '✔ Soldée',
    chargeOverpaid: '↩ Trop-perçu',
    chargeLate: '⚠ En retard',
    chargePartial: '◐ Partiel',
    chargeToPay: '⏳ À payer',
    chargeInvalid: '✖ Montant invalide',
    scheduleDone: '✔ Réalisé',
    schedulePartial: '◐ Partiel',
    scheduleLate: '⚠ En retard',
    scheduleUpcoming: '⏳ À venir',
} as const;

const V2_DEFAULT_TYPES = ['Chèque', 'Virement', 'Prélèvement', 'Remboursement', 'Autre'];
const V2_DEFAULT_CATEGORIES = ['Appel de fonds', 'Travaux', 'Régularisation', 'Frais', 'Autre'];
const V2_ALL_CATEGORIES = '(Toutes)';

type V2Column = {
    id: string;
    header: string;
    kind: 'input' | 'calc';
    width: number;
    note: string;
    format?: string;
    formula?: () => string; // header-row (row 2) array formula of a calculated column
};

type V2TableDef = { key: V2TableKey; columns: V2Column[] };

/** Locale-independent ISO date text (TEXT format codes are localized, e.g. "aaaa" in French). */
const v2IsoText = (expr: string): string =>
    `YEAR(${expr})&"-"&RIGHT("0"&MONTH(${expr}),2)&"-"&RIGHT("0"&DAY(${expr}),2)`;

function v2Letter(index: number): string {
    let letters = '';
    for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
        letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
    }
    return letters;
}

function v2Table(key: V2TableKey): V2TableDef {
    const table = V2_TABLES.find(t => t.key === key);
    if (!table) throw new Error(`Unknown table "${key}"`);
    return table;
}

function v2ColIndex(key: V2TableKey, id: string): number {
    const index = v2Table(key).columns.findIndex(c => c.id === id);
    if (index < 0) throw new Error(`Unknown column "${id}" in table "${key}"`);
    return index + 1;
}

/** Open-ended range of a column on its own sheet, e.g. `F2:F`. */
function v2Col(key: V2TableKey, id: string): string {
    const letter = v2Letter(v2ColIndex(key, id));
    return `${letter}2:${letter}`;
}

/** Open-ended range of a column from another sheet, e.g. `'Charges'!$F$2:$F`. */
function v2Ref(key: V2TableKey, id: string): string {
    const letter = v2Letter(v2ColIndex(key, id));
    return `'${V2_SHEET_NAMES[key]}'!$${letter}$2:$${letter}`;
}

const v2PaymentCol = (id: string): string => v2Col('paiements', id);
const v2ChargeCol = (id: string): string => v2Col('charges', id);
const v2AllocationCol = (id: string): string => v2Col('affectations', id);
const v2ScheduleCol = (id: string): string => v2Col('echeances', id);

const V2_PARAMS_RANGES = {
    types: 'A2:A100',
    categories: 'B2:B100',
    chargeList: 'C2:C1000',
    paymentList: 'D2:D1000',
    categoryFilter: 'E2:E100',
};

const V2_TABLES: V2TableDef[] = [
    {
        key: 'paiements',
        columns: [
            {
                id: 'date',
                header: 'Date',
                kind: 'input',
                width: 100,
                format: V2_FORMATS.date,
                note: 'Date du paiement.',
            },
            {
                id: 'type',
                header: 'Type',
                kind: 'input',
                width: 130,
                note: 'Chèque, virement, prélèvement… ou « Remboursement » pour une somme reçue du syndic.',
            },
            {
                id: 'montant',
                header: 'Montant',
                kind: 'input',
                width: 110,
                format: V2_FORMATS.eur,
                note: 'Montant payé. Négatif pour un remboursement reçu du syndic (régularisation).',
            },
            {
                id: 'ref',
                header: 'Réf',
                kind: 'input',
                width: 90,
                note: 'Optionnelle : distingue deux paiements identiques (même date, type et montant).',
            },
            { id: 'note', header: 'Note', kind: 'input', width: 200, note: 'Commentaire libre.' },
            {
                id: 'cle',
                header: 'Clé',
                kind: 'calc',
                width: 290,
                note: 'Identifiant lisible utilisé par les affectations (date · type · montant). Calculé.',
                formula: () =>
                    `=MAP(${v2PaymentCol('date')},${v2PaymentCol('type')},${v2PaymentCol('montant')},${v2PaymentCol('ref')},`
                    + `LAMBDA(dt,typ,amt,ref,IF(dt="","",${v2IsoText('dt')}&" · "&typ&" · "&FIXED(amt,2,TRUE)&IF(ref="",""," · "&ref))))`,
            },
            {
                id: 'affecte',
                header: 'Affecté',
                kind: 'calc',
                width: 110,
                format: V2_FORMATS.eur,
                note: 'Somme déjà répartie sur des charges (onglet Affectations). Calculé.',
                formula: () =>
                    `=MAP(${v2PaymentCol('cle')},LAMBDA(key,IF(key="","",SUMIFS(${v2Ref('affectations', 'montant')},${v2Ref('affectations', 'paiement')},key))))`,
            },
            {
                id: 'nonAlloue',
                header: 'Non alloué',
                kind: 'calc',
                width: 110,
                format: V2_FORMATS.eur,
                note: 'Montant du paiement − affecté. Doit être à 0 une fois le paiement réparti. Calculé.',
                formula: () =>
                    `=MAP(${v2PaymentCol('montant')},${v2PaymentCol('affecte')},LAMBDA(amt,aff,IF(amt="","",ROUND(amt-N(aff),2))))`,
            },
            {
                id: 'statut',
                header: 'Statut',
                kind: 'calc',
                width: 190,
                note: 'Calculé.',
                formula: () =>
                    `=MAP(${v2PaymentCol('cle')},${v2PaymentCol('montant')},${v2PaymentCol('nonAlloue')},LAMBDA(key,amt,rest,`
                    + `IF(key="","",IF(amt="","${V2_STATUS.paymentMissingAmount}",IF(COUNTIF(${v2PaymentCol('cle')},key)>1,"${V2_STATUS.paymentDuplicate}",`
                    + `IF(rest=0,"${V2_STATUS.paymentDone}",IF(rest*amt>0,"${V2_STATUS.paymentToAllocate}","${V2_STATUS.paymentOver}"))))))) `.trimEnd(),
            },
        ],
    },
    {
        key: 'charges',
        columns: [
            {
                id: 'date',
                header: 'Date',
                kind: 'input',
                width: 100,
                format: V2_FORMATS.date,
                note: "Date d'exigibilité. Sans échéancier, la charge est due en totalité à cette date.",
            },
            {
                id: 'categorie',
                header: 'Catégorie',
                kind: 'input',
                width: 140,
                note: 'Appel de fonds, travaux, régularisation…',
            },
            {
                id: 'libelle',
                header: 'Libellé',
                kind: 'input',
                width: 220,
                note: 'Nom de la charge. Attention : le modifier après affectation casse le lien (contrôle ✖ dans Affectations).',
            },
            {
                id: 'montant',
                header: 'Montant dû',
                kind: 'input',
                width: 110,
                format: V2_FORMATS.eur,
                note: 'Montant total de la charge (positif).',
            },
            { id: 'note', header: 'Note', kind: 'input', width: 180, note: 'Commentaire libre.' },
            {
                id: 'cle',
                header: 'Clé',
                kind: 'calc',
                width: 260,
                note: 'Identifiant lisible utilisé par les affectations et échéances (date · libellé). Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('date')},${v2ChargeCol('libelle')},LAMBDA(dt,lib,IF(dt="","",${v2IsoText('dt')}&" · "&lib)))`,
            },
            {
                id: 'paye',
                header: 'Payé',
                kind: 'calc',
                width: 110,
                format: V2_FORMATS.eur,
                note: 'Somme des affectations vers cette charge (remboursements déduits). Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('cle')},LAMBDA(key,IF(key="","",SUMIFS(${v2Ref('affectations', 'montant')},${v2Ref('affectations', 'charge')},key))))`,
            },
            {
                id: 'reste',
                header: 'Reste à payer',
                kind: 'calc',
                width: 120,
                format: V2_FORMATS.eur,
                note: 'Montant dû − payé. Négatif = trop-perçu. Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('montant')},${v2ChargeCol('paye')},LAMBDA(amt,paid,IF(amt="","",ROUND(amt-N(paid),2))))`,
            },
            {
                id: 'solde',
                header: 'Solde',
                kind: 'calc',
                width: 110,
                format: V2_FORMATS.signed,
                note: 'Payé − dû : positif = crédit, 0 = à jour, négatif = en retard de paiement. Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('montant')},${v2ChargeCol('paye')},LAMBDA(amt,paid,IF(amt="","",ROUND(N(paid)-amt,2))))`,
            },
            {
                id: 'avancement',
                header: 'Avancement',
                kind: 'calc',
                width: 150,
                note: 'Part payée du montant dû. Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('montant')},${v2ChargeCol('paye')},LAMBDA(amt,paid,IF(N(amt)<=0,"",`
                    + `LET(p,N(paid)/amt,n,MAX(0,MIN(10,ROUND(p*10,0))),REPT("█",n)&REPT("░",10-n)&" "&TEXT(p,"0%")))))`,
            },
            {
                id: 'objectif',
                header: 'Objectif à ce jour',
                kind: 'calc',
                width: 130,
                format: V2_FORMATS.eur,
                note: "Cumul des échéances prévues jusqu'à aujourd'hui (sans échéancier : le montant dû à la date de la charge). Calculé.",
                formula: () =>
                    `=MAP(${v2ChargeCol('cle')},${v2ChargeCol('date')},${v2ChargeCol('montant')},LAMBDA(key,dt,amt,IF(key="","",`
                    + `IF(COUNTIF(${v2Ref('echeances', 'charge')},key)=0,IF(dt<=TODAY(),N(amt),0),`
                    + `MIN(N(amt),SUMIFS(${v2Ref('echeances', 'montant')},${v2Ref('echeances', 'charge')},key,${v2Ref('echeances', 'date')},"<="&TODAY()))))))`,
            },
            {
                id: 'retard',
                header: 'Retard',
                kind: 'calc',
                width: 110,
                format: V2_FORMATS.eur,
                note: 'Objectif à ce jour − payé (jamais négatif). Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('objectif')},${v2ChargeCol('paye')},LAMBDA(goal,paid,IF(goal="","",ROUND(MAX(0,goal-N(paid)),2))))`,
            },
            {
                id: 'prochaine',
                header: 'Prochaine échéance',
                kind: 'calc',
                width: 130,
                format: V2_FORMATS.date,
                note: 'Prochaine date prévue dans l’échéancier. Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('cle')},LAMBDA(key,IF(key="","",LET(nxt,MINIFS(${v2Ref('echeances', 'date')},${v2Ref('echeances', 'charge')},key,${v2Ref('echeances', 'date')},">"&TODAY()),IF(nxt=0,"",nxt)))))`,
            },
            {
                id: 'parEcheance',
                header: 'À payer / échéance restante',
                kind: 'calc',
                width: 150,
                format: V2_FORMATS.eur,
                note: 'Objectif recalculé : reste à payer ÷ nombre d’échéances à venir. Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('cle')},${v2ChargeCol('reste')},LAMBDA(key,rest,IF(key="","",`
                    + `LET(n,COUNTIFS(${v2Ref('echeances', 'charge')},key,${v2Ref('echeances', 'date')},">"&TODAY()),IF(OR(n=0,rest<=0),"",ROUND(rest/n,2))))))`,
            },
            {
                id: 'statut',
                header: 'Statut',
                kind: 'calc',
                width: 150,
                note: 'Calculé.',
                formula: () =>
                    `=MAP(${v2ChargeCol('cle')},${v2ChargeCol('montant')},${v2ChargeCol('paye')},${v2ChargeCol('reste')},${v2ChargeCol('retard')},`
                    + `LAMBDA(key,amt,paid,rest,late,IF(key="","",IF(N(amt)<=0,"${V2_STATUS.chargeInvalid}",IF(rest=0,"${V2_STATUS.chargeDone}",`
                    + `IF(rest<0,"${V2_STATUS.chargeOverpaid}",IF(late>0,"${V2_STATUS.chargeLate}",IF(N(paid)>0,"${V2_STATUS.chargePartial}","${V2_STATUS.chargeToPay}"))))))))`,
            },
        ],
    },
    {
        key: 'affectations',
        columns: [
            {
                id: 'paiement',
                header: 'Paiement',
                kind: 'input',
                width: 300,
                note: 'Choisissez un paiement dans la liste (ceux à répartir apparaissent en premier).',
            },
            {
                id: 'charge',
                header: 'Charge',
                kind: 'input',
                width: 300,
                note: 'Choisissez une charge dans la liste (les charges restant à payer apparaissent en premier, les plus anciennes d’abord).',
            },
            {
                id: 'montant',
                header: 'Montant affecté',
                kind: 'input',
                width: 120,
                format: V2_FORMATS.eur,
                note: 'Part du paiement affectée à cette charge. Négatif pour un remboursement.',
            },
            {
                id: 'nonAlloue',
                header: 'Non alloué du paiement',
                kind: 'calc',
                width: 130,
                format: V2_FORMATS.eur,
                note: 'Ce qu’il reste à répartir sur ce paiement (toutes lignes comprises). Calculé.',
                formula: () =>
                    `=MAP(${v2AllocationCol('paiement')},LAMBDA(pay,IF(pay="","",IF(COUNTIF(${v2Ref('paiements', 'cle')},pay)=0,"?",SUMIFS(${v2Ref('paiements', 'nonAlloue')},${v2Ref('paiements', 'cle')},pay)))))`,
            },
            {
                id: 'reste',
                header: 'Reste dû de la charge',
                kind: 'calc',
                width: 130,
                format: V2_FORMATS.eur,
                note: 'Ce qu’il reste à payer sur cette charge (toutes lignes comprises). Calculé.',
                formula: () =>
                    `=MAP(${v2AllocationCol('charge')},LAMBDA(ch,IF(ch="","",IF(COUNTIF(${v2Ref('charges', 'cle')},ch)=0,"?",SUMIFS(${v2Ref('charges', 'reste')},${v2Ref('charges', 'cle')},ch)))))`,
            },
            {
                id: 'suggestion',
                header: 'Montant suggéré',
                kind: 'calc',
                width: 120,
                format: V2_FORMATS.eur,
                note: 'Plus petit montant entre le non alloué du paiement et le reste dû de la charge (avant cette ligne). Calculé, non appliqué.',
                formula: () =>
                    `=MAP(${v2AllocationCol('paiement')},${v2AllocationCol('charge')},${v2AllocationCol('montant')},${v2AllocationCol('nonAlloue')},${v2AllocationCol('reste')},`
                    + `LAMBDA(pay,ch,amt,np,rc,IF(OR(pay="",ch="",np="?",rc="?"),"",LET(ap,np+N(amt),ac,rc+N(amt),IF(ap>=0,ROUND(MAX(0,MIN(ap,ac)),2),ROUND(ap,2))))))`,
            },
            {
                id: 'controle',
                header: 'Contrôle',
                kind: 'calc',
                width: 260,
                note: 'Cohérence de la ligne. Calculé.',
                formula: () =>
                    `=MAP(${v2AllocationCol('paiement')},${v2AllocationCol('charge')},${v2AllocationCol('montant')},${v2AllocationCol('nonAlloue')},${v2AllocationCol('reste')},`
                    + `LAMBDA(pay,ch,amt,np,rc,IF(AND(pay="",ch="",amt=""),"",IF(pay="","✖ Choisir un paiement",IF(ch="","✖ Choisir une charge",`
                    + `IF(OR(np="?",rc="?"),"✖ Paiement ou charge introuvable (clé modifiée ?)",IF(amt="","⚠ Saisir un montant",`
                    + `IF(COUNTIF(${v2Ref('paiements', 'cle')},pay)>1,"⚠ Paiement en doublon",`
                    + `IF(OR(AND(SUMIFS(${v2Ref('paiements', 'montant')},${v2Ref('paiements', 'cle')},pay)>=0,np<0),AND(SUMIFS(${v2Ref('paiements', 'montant')},${v2Ref('paiements', 'cle')},pay)<0,np>0)),`
                    + `"✖ Dépasse le montant du paiement",IF(rc<0,"⚠ Dépasse le dû de la charge","✔"))))))))))`,
            },
            {
                id: 'datePaiement',
                header: 'Date du paiement',
                kind: 'calc',
                width: 120,
                format: V2_FORMATS.date,
                note: 'Calculé.',
                formula: () =>
                    `=MAP(${v2AllocationCol('paiement')},LAMBDA(pay,IF(pay="","",IFERROR(INDEX(${v2Ref('paiements', 'date')},MATCH(pay,${v2Ref('paiements', 'cle')},0)),""))))`,
            },
            {
                id: 'categorie',
                header: 'Catégorie',
                kind: 'calc',
                width: 140,
                note: 'Calculé.',
                formula: () =>
                    `=MAP(${v2AllocationCol('charge')},LAMBDA(ch,IF(ch="","",IFERROR(INDEX(${v2Ref('charges', 'categorie')},MATCH(ch,${v2Ref('charges', 'cle')},0)),""))))`,
            },
        ],
    },
    {
        key: 'echeances',
        columns: [
            {
                id: 'charge',
                header: 'Charge',
                kind: 'input',
                width: 300,
                note: 'Charge concernée. Lignes saisies à la main ou générées par le menu Charges TBA.',
            },
            {
                id: 'date',
                header: 'Date prévue',
                kind: 'input',
                width: 110,
                format: V2_FORMATS.date,
                note: 'Date objectif du versement.',
            },
            {
                id: 'montant',
                header: 'Montant prévu',
                kind: 'input',
                width: 120,
                format: V2_FORMATS.eur,
                note: 'Montant objectif à cette date. Le total par charge doit égaler le montant dû.',
            },
            {
                id: 'categorie',
                header: 'Catégorie',
                kind: 'calc',
                width: 140,
                note: 'Calculé.',
                formula: () =>
                    `=MAP(${v2ScheduleCol('charge')},LAMBDA(ch,IF(ch="","",IFERROR(INDEX(${v2Ref('charges', 'categorie')},MATCH(ch,${v2Ref('charges', 'cle')},0)),""))))`,
            },
            {
                id: 'cumul',
                header: 'Cumul prévu',
                kind: 'calc',
                width: 120,
                format: V2_FORMATS.eur,
                note: 'Cumul des échéances de la charge jusqu’à cette date incluse. Calculé.',
                formula: () =>
                    `=MAP(${v2ScheduleCol('charge')},${v2ScheduleCol('date')},LAMBDA(ch,dt,IF(OR(ch="",dt=""),"",SUMIFS(${v2ScheduleCol('montant')},${v2ScheduleCol('charge')},ch,${v2ScheduleCol('date')},"<="&dt))))`,
            },
            {
                id: 'paye',
                header: 'Payé (charge)',
                kind: 'calc',
                width: 120,
                format: V2_FORMATS.eur,
                note: 'Total payé sur la charge, imputé sur les échéances dans l’ordre chronologique. Calculé.',
                formula: () =>
                    `=MAP(${v2ScheduleCol('charge')},LAMBDA(ch,IF(ch="","",SUMIFS(${v2Ref('charges', 'paye')},${v2Ref('charges', 'cle')},ch))))`,
            },
            {
                id: 'statut',
                header: 'Statut',
                kind: 'calc',
                width: 130,
                note: 'Calculé.',
                formula: () =>
                    `=MAP(${v2ScheduleCol('charge')},${v2ScheduleCol('date')},${v2ScheduleCol('montant')},${v2ScheduleCol('cumul')},${v2ScheduleCol('paye')},`
                    + `LAMBDA(ch,dt,amt,cum,paid,IF(OR(ch="",dt=""),"",IF(paid>=cum-0.005,"${V2_STATUS.scheduleDone}",`
                    + `IF(dt<=TODAY(),IF(paid>cum-N(amt),"${V2_STATUS.schedulePartial}","${V2_STATUS.scheduleLate}"),"${V2_STATUS.scheduleUpcoming}")))))`,
            },
            {
                id: 'controle',
                header: 'Contrôle',
                kind: 'calc',
                width: 260,
                note: 'Le total des échéances d’une charge doit égaler son montant dû. Calculé.',
                formula: () =>
                    `=MAP(${v2ScheduleCol('charge')},LAMBDA(ch,IF(ch="","",IF(COUNTIF(${v2Ref('charges', 'cle')},ch)=0,"✖ Charge introuvable (clé modifiée ?)",`
                    + `LET(tot,SUMIFS(${v2ScheduleCol('montant')},${v2ScheduleCol('charge')},ch),due,SUMIFS(${v2Ref('charges', 'montant')},${v2Ref('charges', 'cle')},ch),`
                    + `IF(ABS(tot-due)>0.005,"⚠ Total échéances ≠ dû ("&FIXED(tot-due,2,TRUE)&")","✔"))))))`,
            },
        ],
    },
];
