/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */
type TryCatchOptions = {
    logError?: boolean;
    logger?: (...data: unknown[]) => void;
};

function tryCatch(
    callback: () => void,
    onErrorMessage = '',
    { logError = true, logger = console.warn }: TryCatchOptions = {},
): void {
    try {
        callback();
    } catch (e) {
        const log = logger || console.warn;

        log(onErrorMessage);

        if (logError) {
            const message = e instanceof Error ? 'message: ' + e.message : 'Unknown error occured.';
            const stack =
                e instanceof Error
                    ? '\nThe stack is →\n' + JSON.stringify(e.stack, null, 2)
                    : '\n→ ' + e
                      ? String(e)
                      : '';

            log(message + stack);
        }
    }
}

function getTableByName(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    tableName: string,
): {
    range: GoogleAppsScript.Spreadsheet.Range;
    dataRange: GoogleAppsScript.Spreadsheet.Range;
    header: GoogleAppsScript.Spreadsheet.Range;
} {
    const spreadsheet = sheet.getParent();
    const tableRange = spreadsheet.getRangeByName(tableName);

    if (!tableRange) throw new Error(`Table with name "${tableName}" does not exist`);

    const numRows = tableRange.getNumRows();
    const numCols = tableRange.getNumColumns();

    return {
        range: tableRange,
        // On décale de 1 ligne vers le bas ET on réduit la hauteur de 1 pour exclure l'en-tête
        dataRange: tableRange.offset(1, 0, numRows - 1, numCols),
        header: tableRange.offset(0, 0, 1, numCols),
    };
}

function getColumn(tableRange: GoogleAppsScript.Spreadsheet.Range, columnIndex: number): number {
    const startCol = tableRange.getColumn();
    return startCol + columnIndex;
}

function getRow(tableRange: GoogleAppsScript.Spreadsheet.Range, rowIndex: number): number {
    const startRow = tableRange.getRow();
    return startRow + rowIndex;
}

function getTableCoordinates(tableRange: GoogleAppsScript.Spreadsheet.Range): {
    startRow: number;
    startCol: number;
    lastRow: number;
    lastCol: number;
} {
    return {
        startRow: tableRange.getRow(), // Première ligne
        startCol: tableRange.getColumn(), // Première colonne
        lastRow: tableRange.getLastRow(), // Dernière ligne
        lastCol: tableRange.getLastColumn(), // Dernière colonne
    };
}

function isInTable(
    tableRange: GoogleAppsScript.Spreadsheet.Range,
    { row, column }: { row: number; column: number },
): boolean {
    const { startRow, startCol, lastRow, lastCol } = getTableCoordinates(tableRange);

    if (row >= startRow && row <= lastRow && column >= startCol && column <= lastCol) return true;

    return false;
}

function getTableEntireRow(
    tableRange: GoogleAppsScript.Spreadsheet.Range,
    row: number,
): GoogleAppsScript.Spreadsheet.Range {
    return tableRange.offset(row - 1, 0, 1, tableRange.getNumColumns());
}

function getTableEntireColumn(
    tableRange: GoogleAppsScript.Spreadsheet.Range,
    column: number,
): GoogleAppsScript.Spreadsheet.Range {
    return tableRange.offset(0, column - 1, tableRange.getNumRows(), 1);
}

function getTableCell(
    tableRange: GoogleAppsScript.Spreadsheet.Range,
    { row, column }: { row: number; column: number },
): GoogleAppsScript.Spreadsheet.Range {
    return tableRange.offset(row - 1, column - 1, 1, 1);
}

function getA1Coords(cell: GoogleAppsScript.Spreadsheet.Range): { row: number; column: string } {
    const a1 = cell.getA1Notation();
    const column = a1.match(/[A-Za-z]+/)?.[0];
    if (!column) {
        throw new Error(`Invalid A1 notation: "${a1}"`);
    }
    return { row: cell.getRow(), column };
}

function getA1NotationWithDollars({
    row,
    column,
    $row,
    $column,
}: {
    row?: number;
    column?: string;
    $row?: number;
    $column?: string;
}): string {
    const c = column ?? $column;
    const r = row ?? $row;

    const isCol$ = $column !== undefined;
    const isRow$ = $row != undefined;

    return `${isCol$ ? '$' : ''}${c}${isRow$ ? '$' : ''}${r}`;
}

function get$A1({ row, column }: { row: number; column: string }): string {
    return getA1NotationWithDollars({ row, $column: column });
}

function getA$1({ row, column }: { row: number; column: string }): string {
    return getA1NotationWithDollars({ $row: row, column });
}

function get$A$1({ row, column }: { row: number; column: string }): string {
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
