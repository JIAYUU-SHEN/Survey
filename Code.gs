// Google Apps Script — deployed as Web App, Who has access: Anyone.
// APPEND-ONLY. No destructive operations (no clear, no deleteRow, no setValues overwriting old rows).

const RESPONSES_SHEET = 'Sheet1'; // or whatever your existing responses sheet is called
const COMPLETED_SHEET = 'completed_sessions';
const COMPLETED_HEADERS = ['name', 'normalized_name', 'dataset', 'completed_at', 'total_rounds'];

function normalizeName_(name) {
  return String(name || '').trim().toLowerCase();
}

// Auto-creates completed_sessions sheet if missing. Never touches existing sheets.
function getOrCreateCompletedSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(COMPLETED_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(COMPLETED_SHEET);
    sheet.appendRow(COMPLETED_HEADERS);
  }
  return sheet;
}

// --- GET: read-only check ---
function doGet(e) {
  const params = e.parameter || {};
  if (params.action === 'checkCompleted') {
    const name = normalizeName_(params.name);
    const dataset = String(params.dataset || '');
    const completed = isSessionCompleted_(name, dataset);
    return ContentService
      .createTextOutput(JSON.stringify({ completed }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Read-only scan of completed_sessions. Does NOT modify any data.
function isSessionCompleted_(normalizedName, dataset) {
  const sheet = getOrCreateCompletedSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const data = sheet.getRange(2, 1, lastRow - 1, COMPLETED_HEADERS.length).getValues();
  for (let i = 0; i < data.length; i++) {
    const rowNormName = String(data[i][1] || '').trim().toLowerCase();
    const rowDataset = String(data[i][2] || '');
    if (rowNormName === normalizedName && rowDataset === dataset) {
      return true;
    }
  }
  return false;
}

// --- POST: append responses, and append one summary row to completed_sessions ---
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const responsesSheet = ss.getSheetByName(RESPONSES_SHEET) || ss.getSheets()[0];
  const data = JSON.parse(e.postData.contents);

  // Append each response row. NEVER overwrite existing rows.
  data.forEach(row => {
    responsesSheet.appendRow([
      row.name,
      row.dataset,
      row.round,
      row.file,
      row.original_name || '',
      row.answer,
      row.rating
    ]);
  });

  // Append ONE summary row to completed_sessions for this batch.
  // Only runs when this POST succeeds (ie. all responses were written).
  if (data.length > 0) {
    const first = data[0];
    const completedSheet = getOrCreateCompletedSheet_();
    completedSheet.appendRow([
      first.name,
      normalizeName_(first.name),
      first.dataset,
      new Date(),
      data.length
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
