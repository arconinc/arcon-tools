// Arc Expense Report — Apps Script
const ARC_URL = 'https://thearc.arconinc.com';
// This is defined in https://script.google.com/u/0/home/projects/1CNQP9AgX2YI6gyu1L_US14aJQa5UwaX5V7p9OD-qDSb-Aavx5Y28Qrhx/edit but not checked in
const ARC_API_KEY = 'hidden';

// Reads metadata Arc wrote into the hidden _arc sheet when this file was created.
// A1 = submitter email, A2 = reviewer email, A3 = employee URL, A4 = admin URL
function getArcMetadata() {
    const arcSheet = SpreadsheetApp.getActive().getSheetByName('_arc');
    if (!arcSheet) return { submitter: '', reviewer: '', employeeUrl: '', adminUrl: '' };
    const values = arcSheet.getRange('A1:A4').getValues();
    return {
        submitter:   values[0][0] || '',
        reviewer:    values[1][0] || '',
        employeeUrl: values[2][0] || '',
        adminUrl:    values[3][0] || '',
    };
}

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Arc Expense Report')
        .addItem('✅ Submit for Review', 'submitForReview')
        .addSeparator()
        .addItem('↩ Needs Changes', 'markNeedsChanges')
        .addItem('✓ Approve', 'markApproved')
        .addItem('💰 Submit to Payroll', 'submitToPayroll')
        .addSeparator()
        .addItem('🔗 View in The Arc', 'openInArc')
        .addToUi();
}

function callArc(action, comment) {
    const { submitter, reviewer } = getArcMetadata();
    // Submit is an employee action; all others are reviewer actions
    const userEmail = (action === 'submit') ? submitter : reviewer;
    const fileId = SpreadsheetApp.getActive().getId();
    const body = { drive_file_id: fileId, action };
    if (comment) body.comment = comment;
    const resp = UrlFetchApp.fetch(ARC_URL + '/api/expense-reports/drive-action', {
        method: 'post',
        headers: {
            'Authorization': 'Bearer ' + ARC_API_KEY,
            'X-User-Email': userEmail,
            'Content-Type': 'application/json',
        },
        payload: JSON.stringify(body),
        muteHttpExceptions: true,
    });
    return JSON.parse(resp.getContentText());
}

function submitForReview() {
    const result = callArc('submit');
    if (result.error) { SpreadsheetApp.getUi().alert('Error: ' + result.error); return; }
    SpreadsheetApp.getUi().alert('✅ Submitted! Amy will be notified.');
}

function markNeedsChanges() {
    const comment = SpreadsheetApp.getUi().prompt(
        'Needs Changes', 'Enter a comment for the employee:', SpreadsheetApp.getUi().ButtonSet.OK_CANCEL
    );
    if (comment.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return;
    const result = callArc('needs_changes', comment.getResponseText());
    if (result.error) { SpreadsheetApp.getUi().alert('Error: ' + result.error); return; }
    SpreadsheetApp.getUi().alert('Done — employee notified.');
}

function markApproved() {
    const result = callArc('approve');
    if (result.error) { SpreadsheetApp.getUi().alert('Error: ' + result.error); return; }
    SpreadsheetApp.getUi().alert('✅ Report approved — employee notified.');
}

function submitToPayroll() {
    const result = callArc('submit_to_payroll');
    if (result.error) { SpreadsheetApp.getUi().alert('Error: ' + result.error); return; }
    SpreadsheetApp.getUi().alert('✅ Submitted to payroll — employee notified.');
}

function openInArc() {
    const { employeeUrl, adminUrl } = getArcMetadata();
    // Opens the employee view; Amy can navigate to the admin view from there
    const url = employeeUrl || adminUrl;
    if (!url) { SpreadsheetApp.getUi().alert('Could not find The Arc URL for this report.'); return; }
    const html = HtmlService.createHtmlOutput(
        `<script>window.open('${url}'); google.script.host.close();</script>`
    ).setWidth(1).setHeight(1);
    SpreadsheetApp.getUi().showModalDialog(html, 'Opening The Arc…');
}