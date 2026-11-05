// Définissez un drapeau global en haut de votre script principal
var DEBUG_MODE = false; // Passez à true pendant vos phases de test/debug


// A=1 (Date), B=2 (Type), C=3 (Montant), D=4 (Nombre de paiements), 
// E=5 (Date paiement), F=6 (Somme), G=7 (Payé), H=8 (Remboursement effectué), I=9 (% Avancement)

const COLUMNS = {
  date: 1,
  type: 2,
  montant: 3,
  nbPaiments: 4,
  somme: 6,
  paye: 7,
  remboursement: 8,
  avancement: 9
};

const NB_COLUMNS = Object.keys(COLUMNS).length;

const TABLE_NAME = 'TableCharges';

const COLORS = {
  debitRow: '#e8e8e8',  // Gris foncé pour la ligne principale
  debitPaid: '#d9ead3', // Vert clair
};

const isStictPositiveNumber = v => typeof v === 'number' || v > 0;
const round = nb => nb.toFixed(2);


let isExecuting = false;

/**
 * Déclencheur automatique lors de la modification de la feuille
 */
function onEdit(e) {
  if (isExecuting)
    return; // Empêche la ré-entrance si le script modifie lui-même la feuille
  
  if (!e?.range)
    return;
  
  try {
    isExecuting = true;
    refresh(e.range); //, e.value);
  } finally {
    isExecuting = false; // Libère le verrou dans tous les cas (même en cas d'erreur)
  }
}


function refresh(range /* , value */) {
    const sheet = range.getSheet();
    const absoluteRow = range.getRow();
    const absoluteColumn = range.getColumn();

    const table = getTableByName(sheet, TABLE_NAME);
    
    if(table.range.getNumRows() === 1)
      return;

    if(!isInTable(table.range, { row: absoluteRow, column: absoluteColumn }))
      return false; // current cell not in table


    const { startRow, startCol } = getTableCoordinates(table.range);
    
    const toRelativeRow = absRow => absRow - startRow;
    const toRelativeColumn = absCol => absCol - startCol + 1;
    
    const row = toRelativeRow(absoluteRow);
    const column = toRelativeColumn(absoluteColumn - startCol + 1);

    // const toAbsoluteRow = row => row + startRow;
    // const toAbsoluteCol = col => col + startCol - 1;

    const getCell = (row, column) => getTableCell(table.dataRange, { row, column });
    
    // const _getA1 = (row, column) => getTableCell(table.dataRange, { row, column }).getA1Notation();
    // const _get$A1 = (row, column) => get$A1(getA1Coords(getTableCell(table.dataRange, { row, column })));

    const data = {
      sheet,
      toRelativeRow,
      toRelativeColumn,
      absoluteRow,
      absoluteColumn,
      row,
      column,
      table,
      getCell,
      getA1: (row, column) => getTableCell(table.dataRange, { row, column }).getA1Notation(),
    };   

    console.info(`Charges TBA → Running change on cell (row: ${row}, column: ${column})`);

    createCreditRows(row, data);
    updateCreditRowStatus(row, data);
    setDebitRowFormat(row, data);
    // refreshAllRows(data);
}

const isDebtRow = ({ row, getCell }) => !!getCell(row, COLUMNS.montant).getValue();


/**
 * Parcourt tout le tableau pour appliquer le fond gris aux lignes principales ayant un montant,
 * ou réinitialiser le fond si le montant est vide.
 */
function refreshAllRows(data) {
  const { table } = data;

  // if(table.range.getNumRows() === 1) return;

  // const montantValues = getTableEntireColumn(table.dataRange, COLUMNS.montant).getValues();
  // montantValues[i][0]

  for (let row = 1; row <= table.dataRange.getNumRows(); row++) {
    createCreditRows(row, data);
    setDebitRowFormat(row, data);
    updateCreditRowStatus(row, data);
  }  
}


function createCreditRows(currentRow, data) {
  if(!isDebtRow(data) || data.column !== COLUMNS.nbPaiments && data.column !== COLUMNS.montant)
    return;

  const { absoluteRow, getCell, getA1, sheet } = data;
      
  const totalAmount = getCell(currentRow, COLUMNS.montant).getValue();
  const nbPaiements = getCell(currentRow, COLUMNS.nbPaiments).getValue();
  
  if (!isStictPositiveNumber(nbPaiements) || !isStictPositiveNumber(totalAmount))
    return;


  const isUserSelectedSplitEqualAmounts = (() => {
    if(!DEBUG_MODE) {
      const ui = SpreadsheetApp.getUi();
      
      if(nbPaiements === 1)
        return SpreadsheetApp.getUi().Button.YES;

      return ui.alert(
        `Répartition des paiements (ligne: ${absoluteRow})`,
        `Voulez-vous diviser le montant de ${totalAmount.toFixed(2)} € en ${nbPaiements} paiements égaux ?`,
        ui.ButtonSet.YES_NO
      );
    } 
    
    return null;
  })();   
  
  const getNbCreditRows = (row = currentRow + 1, nb = 0) => isDebtRow({ ...data, row }) ? nb : getNbCreditRows(row + 1, nb++);
  const nbCreditRows = getNbCreditRows();

  if(nbPaiements === nbCreditRows)
    return;

  if(nbPaiements - nbCreditRows > 0) {
    // Insertion des n sous-lignes sous la ligne principale
    sheet.insertRowsAfter(absoluteRow + nbCreditRows, nbPaiements - nbCreditRows);
  }

  const splitEqually = !DEBUG_MODE ? isUserSelectedSplitEqualAmounts === SpreadsheetApp.getUi().Button.YES : true;

  const equalAmount = splitEqually ? Math.floor((totalAmount / nbPaiements) * 100) / 100 : 0;
  
  // S'assurer que la ligne principale (parent) n'a pas de case à cocher dans la colonne Payé
  tryCatch(() => {
    getCell(currentRow, COLUMNS.paye).clearContent();
    getCell(currentRow, COLUMNS.paye).clearDataValidations();
  }, 'La cellule est verrouillée par le type de colonne.');

  for (let i = 1; i <= nbPaiements; i++) {
    const targetRow = currentRow + i;
    const sommeCell = getCell(targetRow, COLUMNS.somme);

    // Gestion de la Somme (Colonne F)
    if(nbPaiements > 1) {
      if (i === nbPaiements) {
          const startSumRow = currentRow + 1;
          const endSumRow = currentRow + nbPaiements - 1;
          
          const formulaSum = `=${getA1(currentRow, COLUMNS.montant)}-SUM(${getA1(startSumRow, COLUMNS.somme)}:${getA1(endSumRow, COLUMNS.somme)})`;
          sommeCell.setFormula(formulaSum);
      } else {
        if (splitEqually) {
          sommeCell.setValue(equalAmount);
        }
      }
    } else {
      sommeCell.setValue(totalAmount);
    }

    // Insertion de la case à cocher dans la colonne Payé (G)
    // tryCatch(() => sheet.getRange(targetRow, COL_PAYE).insertCheckboxes(), 'Colonne typée gère déjà les cases à cocher.');
  }
}


function setDebitRowFormat(currentRow, data) {
  const { table } = data;
 
  const rowRange = getTableEntireRow(table.dataRange, currentRow);

  if(!isDebtRow(data)) {
    rowRange.setBackground(null); // Réinitialisation si vide
    return;
  }
  console.log(rowRange.getA1Notation());
  tryCatch(() => rowRange.setBackground(COLORS.debitRow), 'Erreur lors de la modification du fond gris de la ligne principale');
}


/**
 * Met à jour le statut, l'avancement et colore la case Montant parente en vert si 100% payé
 */
function updateCreditRowStatus(currentRow, data) {
  if(isDebtRow(data))
    return;

  const { getCell, toRelativeRow } = data;

  const debitAmountCell = getCell(currentRow, COLUMNS.montant).getNextDataCell(SpreadsheetApp.Direction.UP);
  const debitRow = toRelativeRow(debitAmountCell.getRow());
  
  const totalAmount = debitAmountCell.getValue();
  const nbPaiements = getCell(debitRow, COLUMNS.nbPaiments).getValue();

  const setStatus = (row = 1, info = { sum: 0, isAllPaid: true }) => {
    if(row === nbPaiements + 1)
      return info.isAllPaid;

    const isPaid = getCell(debitRow + row, COLUMNS.paye).getValue();
    const amount = getCell(debitRow + row, COLUMNS.somme).getValue();

    if (isPaid && amount >= 0) {   

      const cumulatedCredits = info.sum + amount;
      const remaining = totalAmount - cumulatedCredits;
      const progress = parseFloat(round(cumulatedCredits / totalAmount));

      const textStatus = `${round(cumulatedCredits)} € / ${round(totalAmount)} € → reste: ${round(remaining)} €`;

      getCell(debitRow + row, COLUMNS.remboursement).setValue(textStatus);
      getCell(debitRow + row, COLUMNS.avancement).setValue(progress);

    // tryCatch(() => { sheet.getRange(r, COL_AVANCEMENT).setNumberFormat('0.00%'); }, 'Colonne typée: impossible de changer le format');
    } else {
      getCell(debitRow + row, COLUMNS.remboursement).clearContent();
      getCell(debitRow + row, COLUMNS.avancement).clearContent();
    }

    return setStatus(row + 1, { sum: info.sum + amount, isAllPaid: info.isAllPaid && isPaid });
  }

  /*const getCreditsInfo = (row, info = { sum: 0, allPaid: true, debitAmountCell: null }) => {
    if(isDebtRow({ ...data, row }))
     return { ...info, debitAmountCell: getCell(row, COLUMNS.montant) };
     
     const isPaid = getCell(row, COLUMNS.somme).getValue();
     const amount = getCell(row, COLUMNS.somme).getValue();

     return getCreditsInfo(row - 1, { sum: info.sum + amount, allPaid: info.allPaid && isPaid });
  }

  const creditsInfo = getCreditsInfo(getCell(currentRow, COLUMNS.somme).getNextDataCell(SpreadsheetApp.Direction.DOWN).getRow());
  // const debitAmountCell = getCell(currentRow, COLUMNS.montant).getNextDataCell(SpreadsheetApp.Direction.UP);
  */
  const isAllPaid = setStatus();
  
  // Si tous les paiements de la série sont cochés (100% payé), on colore le montant parent en vert
  tryCatch(() => {
    if (isAllPaid) {
      debitAmountCell.setBackground(COLORS.debitPaid);
    } else {
      debitAmountCell.setBackground(null);     // Supprime la couleur si incomplet
    }
  },'Impossible de modifier la couleur de fond de la cellule Montant');
}


/* function setRemboursementFormulas({ currentRow }) {
  // Injection des formules H et I avec des points-virgules stricts (syntaxe française)
  const startRowRange = currentRow + 1;
  
  // Formule H : Remboursement effectué
  const formulaH = `=IF(${_getA1(targetRow, COLUMNS.paye)}=TRUE; TEXT(SUMIF(${_get$A1(startRowRange, COLUMNS.paye)}:${_getA1(targetRow, COLUMNS.paye)}; TRUE; ${_get$A1(startRowRange, COLUMNS.somme)}:${_get$A1(targetRow, COLUMNS.somme)}); "# ##0 €") & " / " & TEXT(${_get$A1(targetRow, COLUMNS.montant)}; "# ##0 €") & " → " & TEXT(${_get$A1(targetRow, COLUMNS.montant)} - SUMIF(${_get$A1(startRowRange, COLUMNS.paye)}:${_getA1(targetRow, COLUMNS.paye)}; TRUE; ${_get$A1(startRowRange, COLUMNS.somme)}:${_getA1(targetRow, COLUMNS.somme)}); "# ##0 €"); "")`;

  const formulaI = `=IF(${_get$A1(targetRow, COLUMNS.paye)}=TRUE; SUMIF(${_get$A1(startRowRange, COLUMNS.paye)}:${_getA1(targetRow, COLUMNS.paye)}; TRUE; ${_get$A1(startRowRange, COLUMNS.somme)}:${_getA1(targetRow, COLUMNS.somme)}) / ${_get$A1(currentRow, COLUMNS.montant)}; "")`;

  getTableCell(table.dataRange, { row: targetRow, column: COLUMNS.remboursement }).setFormula(formulaH);
  getTableCell(table.dataRange, { row: targetRow, column: COLUMNS.avancement }).setFormula(formulaI);
}*/
