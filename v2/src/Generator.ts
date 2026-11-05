/* eslint-disable no-unused-vars -- Apps Script exposes symbols globally across script files. */

/** Replaces the installments of one charge. Rows are never deleted so the formula rows stay intact. */
function v2WriteSchedule(
    ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
    chargeKey: string,
    installments: V2Installment[],
): void {
    const sheet = v2Sheet(ss, 'echeances');
    const width = 3;
    const rows = sheet.getRange(2, 1, V2_MAX_ROWS - 1, width).getValues();
    const kept = rows.filter(r => !v2IsBlank(r[0]) && String(r[0]) !== chargeKey);
    const next = kept.concat(installments.map(i => [chargeKey, v2ToSheetDate(i.date), i.amount]));
    if (next.length > V2_MAX_ROWS - 1) throw new Error('Limite de 1000 lignes atteinte');
    const padded = next.concat(Array.from({ length: V2_MAX_ROWS - 1 - next.length }, () => ['', '', '']));
    sheet.getRange(2, 1, V2_MAX_ROWS - 1, width).setValues(padded);
}

function v2ActiveChargeKey(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): { key: string; total: number; date: string } {
    const sheet = ss.getActiveSheet();
    if (sheet.getName() !== V2_SHEET_NAMES.charges)
        throw new Error('Sélectionnez d’abord une ligne de l’onglet « Charges ».');
    const row = ss.getActiveRange()?.getRow() ?? 0;
    if (row < 2) throw new Error('Sélectionnez une ligne de charge (pas l’en-tête).');
    const key = String(sheet.getRange(row, v2ColIndex('charges', 'cle')).getValue());
    const total = Number(sheet.getRange(row, v2ColIndex('charges', 'montant')).getValue());
    const date = v2ToIso(sheet.getRange(row, v2ColIndex('charges', 'date')).getValue());
    if (!key || !(total > 0)) throw new Error('Cette ligne ne contient pas de charge valide.');
    return { key, total, date };
}

function v2PromptText(ui: GoogleAppsScript.Base.Ui, title: string, message: string): string | null {
    const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
    return response.getSelectedButton() === ui.Button.OK ? response.getResponseText().trim() : null;
}

function v2GenerateUniformUi(): string {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    const charge = v2ActiveChargeKey(ss);
    const count = v2PromptText(ui, 'Échéancier uniforme', `Charge : ${charge.key}\nNombre d'échéances ?`);
    if (count === null) return 'Annulé';
    const every = v2PromptText(ui, 'Échéancier uniforme', 'Périodicité en mois (1 = mensuel, 3 = trimestriel) ?');
    if (every === null) return 'Annulé';
    const start = v2PromptText(
        ui,
        'Échéancier uniforme',
        `Date de début (jj/mm/aaaa) ?\nVide = date de la charge (${charge.date}).`,
    );
    if (start === null) return 'Annulé';
    const schedule = v2GenerateSchedule(
        charge.total,
        Number(count),
        start ? v2ToIso(start) : charge.date,
        Number(every),
    );
    v2WriteSchedule(ss, charge.key, schedule);
    return `${schedule.length} échéances créées`;
}

function v2GenerateCustomUi(): string {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    const charge = v2ActiveChargeKey(ss);
    const dates = v2PromptText(
        ui,
        'Calendrier personnalisé',
        `Charge : ${charge.key}\nDates séparées par des virgules (jj/mm/aaaa). Le montant est réparti à parts égales.`,
    );
    if (dates === null) return 'Annulé';
    const iso = dates
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(v2ToIso)
        .join(',');
    const schedule = v2GenerateCustomSchedule(charge.total, iso);
    v2WriteSchedule(ss, charge.key, schedule);
    return `${schedule.length} échéances créées`;
}

function v2ClearScheduleUi(): string {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const charge = v2ActiveChargeKey(ss);
    v2WriteSchedule(ss, charge.key, []);
    return 'Échéancier supprimé (la charge est due en une fois)';
}
