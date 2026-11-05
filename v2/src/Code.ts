/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */

/** Runs an action with a visible loading toast and a clear success or error message. */
function v2Run(label: string, action: () => string | void): void {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.toast(`⏳ ${label}…`, 'Charges TBA', -1);
    try {
        const message = action();
        ss.toast(`✅ ${message || label}`, 'Charges TBA', 5);
    } catch (error) {
        ss.toast('❌ Échec', 'Charges TBA', 5);
        SpreadsheetApp.getUi().alert(
            'Charges TBA',
            error instanceof Error ? error.message : String(error),
            SpreadsheetApp.getUi().ButtonSet.OK,
        );
    }
}

function onOpen(): void {
    SpreadsheetApp.getUi()
        .createMenu('Charges TBA')
        .addItem('⚙️ Installer / réparer les onglets', 'menuInstall')
        .addSeparator()
        .addItem('📅 Échéancier uniforme (charge sélectionnée)', 'menuGenerateUniform')
        .addItem('🗓 Calendrier personnalisé (charge sélectionnée)', 'menuGenerateCustom')
        .addItem('🧹 Supprimer l’échéancier (charge sélectionnée)', 'menuClearSchedule')
        .addSeparator()
        .addItem('🔍 Contrôle de cohérence', 'menuSelfCheck')
        .addItem('🧪 Ajouter des données de démonstration', 'menuDemo')
        .addItem('📥 Importer depuis la v1', 'menuImportV1')
        .addToUi();
}

function menuInstall(): void {
    v2Run('Installation des onglets', () => {
        v2Install(SpreadsheetApp.getActiveSpreadsheet());
        return 'Onglets installés';
    });
}

function menuGenerateUniform(): void {
    v2Run('Création de l’échéancier', v2GenerateUniformUi);
}

function menuGenerateCustom(): void {
    v2Run('Création du calendrier', v2GenerateCustomUi);
}

function menuClearSchedule(): void {
    v2Run('Suppression de l’échéancier', v2ClearScheduleUi);
}

function menuSelfCheck(): void {
    v2Run('Contrôle de cohérence', () => {
        const problems = v2SelfCheck(SpreadsheetApp.getActiveSpreadsheet());
        if (problems.length === 0) return 'Aucune différence entre les formules et le calcul de référence';
        SpreadsheetApp.getUi().alert(
            'Écarts détectés',
            problems.slice(0, 20).join('\n'),
            SpreadsheetApp.getUi().ButtonSet.OK,
        );
        return `${problems.length} écart(s) détecté(s)`;
    });
}

function menuDemo(): void {
    v2Run('Ajout des données de démonstration', () => {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        v2ImportModel(ss, v2DemoModel(v2ToIso(new Date())));
        return 'Données de démonstration ajoutées';
    });
}

function menuImportV1(): void {
    v2Run('Import depuis la v1', () => {
        const ui = SpreadsheetApp.getUi();
        const id = v2PromptText(ui, 'Import v1', 'Identifiant du classeur v1 (dans son URL, entre /d/ et /edit) :');
        if (!id) return 'Annulé';
        const model = v2ImportFromV1(SpreadsheetApp.getActiveSpreadsheet(), id);
        return `${model.charges.length} charges, ${model.payments.length} paiements importés`;
    });
}
