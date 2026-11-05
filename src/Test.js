function testDebug() {
  DEBUG_MODE = true;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Charges'); // Remplacez par le nom exact de votre onglet
  const dummyEvent = {
    range: sheet.getRange('G10'),
    // range: sheet.getRange('D12'), // La cellule où vous simulez la saisie de n
    value: '3'                   // La valeur simulée (ex: 3 paiements)
  };
  onEdit(dummyEvent); // Appel direct avec l'événement simulé
}