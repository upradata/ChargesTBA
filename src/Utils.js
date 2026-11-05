function tryCatch(f, onErrorMessage = '', { logError = true, logger = console.warn } = {}) {
  try {
    f();
  } catch(e) {
    const log = logger || console.warn;
    
    log(onErrorMessage);
    
    if(logError) {
      const message = e instanceof Error ? 'message: ' + e.message : 'Unknown error occured.';
      const stack = e instanceof Error ?'\nThe stack is →\n' + JSON.stringify(e.stack, null, 2) : '\n→ ' + e ? String(e): '';

      log(message + stack);
    }
  }
}


function getTableByName(sheet, tableName) {
  const spreadsheet = sheet.getParent();
  const tableRange = spreadsheet.getRangeByName(tableName);

  if(!tableRange)
    throw new Error(`Table with name "${tableName}" does not exist`);
       
  const numRows = tableRange.getNumRows();
  const numCols = tableRange.getNumColumns();

  return {
    range: tableRange,
    // On décale de 1 ligne vers le bas ET on réduit la hauteur de 1 pour exclure l'en-tête
    dataRange: tableRange.offset(1, 0, numRows - 1, numCols),
    header: tableRange.offset(0, 0, 1, numCols)
  };
}


function getColumn(tableRange, columnIndex) {
  const startCol = tableRange.getColumn();
  return startCol + columnIndex;
}

function getRow(tableRange, rowIndex) {
  const startRow = tableRange.getRow();
  return startRow + rowIndex;
}

function getTableCoordinates(tableRange) {
  return {
   startRow: tableRange.getRow(), // Première ligne
   startCol: tableRange.getColumn(), // Première colonne
   lastRow: tableRange.getLastRow(), // Dernière ligne
   lastCol: tableRange.getLastColumn() // Dernière colonne
  };
}

function isInTable(tableRange, { row, column }) {
  const { startRow, startCol, lastRow, lastCol} = getTableCoordinates(tableRange);
  
  if(row >= startRow && row <= lastRow && column >= startCol && column <= lastCol)
    return true;

  return false;
}

function getTableEntireRow(tableRange, row) {
  return tableRange.offset(row - 1, 0, 1, tableRange.getNumColumns());
}

function getTableEntireColumn(tableRange, column) {
  return tableRange.offset(0, column - 1, tableRange.getNumRows(), 1);
}

function getTableCell(tableRange, { row, column }) {
  return tableRange.offset(row - 1, column - 1, 1, 1);
}


function getA1Coords(cell) {
  const a1 = cell.getA1Notation();
  return { row: cell.getRow(), column: a1.match(/[A-Za-z]+/)[0] };
}


function getA1NotationWithDollars({ row, column, $row, $column }) {
  const c = column ?? $column;
  const r = row ?? $row;

  const isCol$ = $column !== undefined;
  const isRow$ = $row != undefined;

  return `${isCol$ ? '$': ''}${c}${isRow$ ? '$': ''}${r}`;
};


function get$A1({ row, column }) {
  return getA1NotationWithDollars({ row, $column: column });
}

function getA$1({ row, column }) {
  return getA1NotationWithDollars({ $row: row, column });
}

function get$A$1({ row, column }) {
  return getA1NotationWithDollars({ $row: row, $column: column });
}

/* function getContiguousRange({ sheet, startCell, direction }) {
  
  const startRow = startCell.getRow();
  const startCol = startCell.getColumn();
  
  // Vérifie si la cellule de départ est déjà vide
  if (startCell.isBlank()) {
    return null;
  }
  
  // Trouve la dernière cellule remplie dans la colonne en descendant
  const lastFilledCell = startCell.getNextDataCell(direction);
  
  const getRangeData = () => {
    if(direction === SpreadsheetApp.Direction.UP || direction === SpreadsheetApp.Direction.DOWN) {
      const lastRow = lastFilledCell.getRow();
      
      // Si la cellule du bas est en dessous de la ligne de départ, on construit la plage
      const numRows = Math.abs(lastRow - startRow) + 1;
      const numCols = startCell.getNumColumns();
      
      return { startRow, startCol, numRows, numCols };
    }

    // ROWS direction
    const lastCol = lastFilledCell.getColumn();
    
    // Si la cellule du bas est en dessous de la ligne de départ, on construit la plage
    const numCols = Math.abs(lastCol - startCol) + 1;
    const numRows = startCell.getNumRows();

    return { startRow, startCol, numRows, numCols };
  }

  return sheet.getRange(...getRangeData());
}*/





