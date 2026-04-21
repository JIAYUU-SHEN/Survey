/**
 * Google Apps Script backend for the 3D Data Validation survey.
 *
 * STRICT APPEND-ONLY GUARANTEE:
 *   - This script never calls clear(), clearContents(), deleteRow(),
 *     deleteRows(), setValues() over an existing range, or any other
 *     destructive Sheets API. Every write goes through appendRow().
 *   - The completed_sessions sheet is a NEW auxiliary sheet for duplicate
 *     detection only; it does NOT replace the responses sheet.
 *   - Reading (checkCompleted) is read-only — it never writes back.
 *
 * Endpoints:
 *   GET  ?action=checkCompleted&name=<normalized>&dataset=<path>
 *           -> { "completed": true|false }
 *   POST  body = JSON array of response objects   (existing format)
 *           -> appended to the responses sheet
 *   POST  body = { action: "markCompleted", name, normalized_name,
 *                  dataset, completed_at, total_rounds }
 *           -> appended to the completed_sessions sheet
 *   POST  body = { action: "checkCompleted", name, dataset }
 *           -> { "completed": true|false } (also available via POST)
 */

// If your existing responses sheet has a specific name, set it here.
// Leave empty to use the first sheet of the active spreadsheet.
var RESPONSES_SHEET_NAME = '';

var COMPLETED_SHEET_NAME = 'completed_sessions';
var COMPLETED_HEADERS = ['name', 'normalized_name', 'dataset', 'completed_at', 'total_rounds'];

function normalizeName_(s) {
  return (s == null ? '' : String(s)).trim().toLowerCase();
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getResponsesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (RESPONSES_SHEET_NAME) {
    var named = ss.getSheetByName(RESPONSES_SHEET_NAME);
    if (named) return named;
  }
  // Match the existing script's behaviour: use the spreadsheet's active sheet
  // (the same target the legacy doPost wrote to). This guarantees new
  // appends land on the exact same sheet as historical responses.
  return ss.getActiveSheet();
}

/**
 * Returns the completed_sessions sheet, creating it (with a header row)
 * the first time it's needed. Creating a new sheet does NOT touch any
 * existing sheet — it's purely additive.
 */
function getOrCreateCompletedSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(COMPLETED_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(COMPLETED_SHEET_NAME);
    sh.appendRow(COMPLETED_HEADERS); // first row: header. Append-only after this.
  }
  return sh;
}

/**
 * Read-only check: does completed_sessions contain a row matching this
 * (normalized_name, dataset)? Never writes anything.
 */
function isCompleted_(name, dataset) {
  var sh = getOrCreateCompletedSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return false; // only header (or empty)
  var values = sh.getRange(2, 1, lastRow - 1, COMPLETED_HEADERS.length).getValues();
  var nn = normalizeName_(name);
  var ds = String(dataset || '').trim();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    // Columns: name, normalized_name, dataset, completed_at, total_rounds
    if (normalizeName_(row[1]) === nn && String(row[2]).trim() === ds) {
      return true;
    }
  }
  return false;
}

/**
 * Appends an array of per-round response objects to the responses sheet.
 * Existing rows are never modified or removed.
 */
function appendResponses_(arr) {
  var sh = getResponsesSheet_();
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i] || {};
    sh.appendRow([
      r.name || '',
      r.dataset || '',
      r.round || '',
      r.file || '',
      r.original_name || '',
      r.answer || '',
      r.rating == null ? '' : r.rating
    ]);
  }
}

/**
 * GET handler — used by the frontend's read-only completion check.
 */
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.action === 'checkCompleted') {
    return jsonOut_({ completed: isCompleted_(p.name || '', p.dataset || '') });
  }
  return jsonOut_({ ok: true });
}

/**
 * POST handler — dispatches by request shape.
 *   - JSON array            -> append responses (legacy / current format)
 *   - { action: "..." }     -> markCompleted / checkCompleted
 *   - { responses: [...] }  -> also accepted as response submission
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ error: 'invalid json' });
  }

  // Existing format: a bare JSON array of response rows.
  if (Array.isArray(body)) {
    appendResponses_(body);
    return jsonOut_({ ok: true, appended: body.length });
  }

  if (body && body.action === 'markCompleted') {
    // Append-only: every submission produces a new row. We intentionally do
    // NOT dedupe here — duplicate suppression happens in the read path.
    var sh = getOrCreateCompletedSheet_();
    sh.appendRow([
      body.name || '',
      body.normalized_name || normalizeName_(body.name || ''),
      body.dataset || '',
      body.completed_at || new Date().toISOString(),
      body.total_rounds || body.totalRounds || ''
    ]);
    return jsonOut_({ ok: true });
  }

  if (body && body.action === 'checkCompleted') {
    return jsonOut_({ completed: isCompleted_(body.name || '', body.dataset || '') });
  }

  // Optional new wrapper format: { responses: [...] }
  if (body && Array.isArray(body.responses)) {
    appendResponses_(body.responses);
    return jsonOut_({ ok: true, appended: body.responses.length });
  }

  return jsonOut_({ error: 'unknown action' });
}
