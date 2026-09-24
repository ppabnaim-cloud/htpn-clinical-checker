/**
 * Wound Vision → Google Sheet
 *
 * Deploy this as a web app bound to the case-log sheet, then paste the /exec URL into the app's
 * "Send straight to a Google Sheet" box. The URL is the capability: anyone holding it can append
 * rows to this sheet, so treat it like a password and do not commit it anywhere.
 *
 * Setup, about three minutes:
 *   1. Open the sheet → Extensions → Apps Script.
 *   2. Replace everything in Code.gs with this file.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      "Anyone" means anyone with the URL; the sheet itself stays private.
 *   4. Authorise when prompted, then copy the URL ending in /exec.
 *
 * If your administrator has disabled Apps Script or web-app deployment, step 3 will refuse. That
 * is a Workspace policy, not a fault in this script, and the app's "Copy for Sheets" button
 * remains the way to get the data across.
 */

// The sheet this writes to. Leave as is to use the sheet the script is bound to.
var SHEET_ID = '1JxWPsLTrpN18zOXgjg5HIFxIP-F2CsJmJKHvLPJrTAc';

function doPost(e) {
  var lock = LockService.getScriptLock();          // two clinicians can save at the same moment
  lock.waitLock(20000);
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    var body  = JSON.parse(e.postData.contents);
    var rows  = body.rows || [];

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Existing ids, so that sending the same cases twice adds nothing the second time.
    var lastRow = sheet.getLastRow();
    var seen = {};
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) { seen[String(r[0])] = true; });
    }

    var out = [];
    rows.forEach(function (r) {
      if (!r.id || seen[String(r.id)]) return;
      seen[String(r.id)] = true;
      out.push(headers.map(function (h) { return r[h] === undefined ? '' : r[h]; }));
    });

    if (out.length) sheet.getRange(lastRow + 1, 1, out.length, lastCol).setValues(out);

    return ContentService
      .createTextOutput(JSON.stringify({ added: out.length, received: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/** Lets you confirm the deployment is alive by opening the URL in a browser. */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, note: 'Wound Vision sheet endpoint is live. POST rows to it.' }))
    .setMimeType(ContentService.MimeType.JSON);
}
