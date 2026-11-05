/* eslint-disable no-unused-vars -- Apps Script invokes debug and trigger functions by global name. */
function testDebug(): void {
    DEBUG_MODE = true;
    PERFORMANCE_TIMING_ENABLED = true;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Charges'); // Remplacez par le nom exact de votre onglet
    if (!sheet) {
        throw new Error('The "Charges" sheet does not exist.');
    }
    const dummyEvent = {
        range: sheet.getRange('G10'),
        // range: sheet.getRange('D12'), // La cellule où vous simulez la saisie de n
        value: '3', // La valeur simulée (ex: 3 paiements)
    };
    onEdit(dummyEvent); // Appel direct avec l'événement simulé
}
