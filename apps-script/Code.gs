/**
 * Wives Hangout Registration: Google Sheet mirror (Apps Script bound to the church's Sheet).
 * Paste into Extensions → Apps Script of "Wives Hangout – Registrations".
 *
 * Supabase is the system of record. This script only:
 *   - copies new registrations into the Sheet every 5 minutes (and on "Wives Hangout → Sync now")
 *   - pings /api/email-retry so failed confirmation emails are re-sent
 *   - emails ALERT_EMAIL a daily summary at 7am, and an alert when something is wrong
 *
 * One database holds production rows (EVENT_SLUG wives-hangout-2026) and test rows
 * (wives-hangout-2026-dev). This Sheet normally mirrors production only. If EVENT_SLUG is
 * temporarily set to a -dev slug, rows go to a separate "Registrations (DEV)" tab instead.
 *
 * Setup (once):
 *   1. Project Settings → Script Properties:
 *        SUPABASE_URL, SUPABASE_SECRET_KEY, EVENT_SLUG
 *        RETRY_URL, RETRY_SECRET   (optional; skipped when unset)
 *        ALERT_EMAIL               (optional; who gets the summary and alerts)
 *   2. Run setupSheet, then installTrigger (approve the permission prompts).
 */

var REGISTRATION_HEADERS = [
  'id', 'created_at', 'full_name', 'years_married', 'phone', 'email', 'church', 'church_other',
  'heard_via', 'heard_other', 'bringing_child', 'consent_at', 'source', 'synced_at',
  // Columns added later go at the END so existing rows never shift (setupSheet appends them).
  'occupation', // migration 002, 2026-10-11
];
var TABS = {
  Registrations: REGISTRATION_HEADERS,
  Log: ['at', 'level', 'action', 'message'],
  // Record every deletion request handled (filled in by hand; see docs/ADMIN_GUIDE.md).
  Deletions: ['date', 'registration_id', 'requested_via', 'done_by', 'notes'],
};
var DEV_TAB = 'Registrations (DEV)';

// Written with a leading ' so Sheets keeps it as text: it drops the leading 0 of "08012345678".
// Meal codes too: a code like "2E45" would otherwise become a number.
var FORCE_TEXT = { phone: true, code: true };
var SYNC_BATCH = 500;
var ALERT_REPEAT_SECONDS = 21600; // the same alert at most every 6 hours
var SPIKE_PER_HOUR = 60;          // expected headcount is 100–150 in total
var PREFIX = '[Wives Hangout] ';

function slug_() {
  return PropertiesService.getScriptProperties().getProperty('EVENT_SLUG') || '';
}

function isDev_() {
  return /-dev$/.test(slug_());
}

/** Production rows go to "Registrations"; test (-dev) rows never mix with them. */
function registrationsTab_() {
  return isDev_() ? DEV_TAB : 'Registrations';
}

/** Creates or checks the tabs and headers. Safe to re-run. */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Africa/Lagos');

  var tabs = { Log: TABS.Log, Deletions: TABS.Deletions };
  tabs[registrationsTab_()] = REGISTRATION_HEADERS;
  Object.keys(tabs).forEach(function (name) {
    var headers = tabs[name];
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var hasData = sheet.getLastRow() > 1;

    if (sheet.getLastRow() > 0) {
      var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      // New columns appended to the end of TABS are fine: the old headers are a prefix.
      var isPrefix = existing.length <= headers.length && existing.every(function (h, i) { return h === headers[i]; });
      if (!isPrefix) {
        if (hasData) {
          throw new Error('Tab "' + name + '" has data under different headers. Clear it by hand; nothing was changed.');
        }
        sheet.clear();
      }
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

/** Sync every 5 minutes; daily summary around 7am. Re-running replaces the old triggers. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'syncFromSupabase' || fn === 'dailyDigest' || fn === 'syncMeals') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncFromSupabase').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('syncMeals').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('dailyDigest').timeBased().everyDays(1).atHour(7).create();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Wives Hangout').addItem('Sync now', 'syncNow').addItem('Sync meals now', 'syncMeals').addToUi();
}

function syncNow() {
  var copied = syncFromSupabase();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    copied === null ? 'A sync is already running. Try again in a minute.' : copied + ' new registration(s) copied.',
    'Wives Hangout');
}

/** Copies unsynced rows into the Registrations tab. Returns the number appended, or null if already running. */
function syncFromSupabase() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return null;
  try {
    var rows = rpc_('sheet_pending', { p_event: slug_(), p_limit: SYNC_BATCH });
    var copied = 0;

    if (rows.length) {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(registrationsTab_());
      if (!sheet) throw new Error('Tab "' + registrationsTab_() + '" is missing. Run setupSheet.');
      var headers = REGISTRATION_HEADERS;
      var lastRow = sheet.getLastRow();
      var present = {};
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) { present[String(r[0])] = true; });
      }

      var now = new Date();
      var toAppend = rows
        .filter(function (r) { return !present[r.id]; })
        .map(function (r) {
          return headers.map(function (h) { return h === 'synced_at' ? now : cell_(h, r[h]); });
        });

      if (toAppend.length) {
        sheet.getRange(lastRow + 1, 1, toAppend.length, headers.length).setValues(toAppend);
        SpreadsheetApp.flush();
        copied = toAppend.length;
      }
      // Mark every fetched row, including ones already present (e.g. after a crash mid-run).
      rpc_('sheet_mark_synced', { p_ids: rows.map(function (r) { return r.id; }) });
    }

    pingRetry_();
    checkAlerts_();
    return copied;
  } catch (err) {
    log_('error', 'syncFromSupabase', String(err));
    alert_('sync-failing', 'Sheet sync is failing',
      'The Google Sheet copy could not sync from Supabase. Registration itself is unaffected.\n\nError: ' + String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** Emails ALERT_EMAIL when something needs a human. */
function checkAlerts_() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ALERT_EMAIL')) return;
  var s = rpc_('ops_summary', { p_event: slug_() });
  var deferred = s.deferred || 0;
  if (s.exhausted > 0) {
    alert_('emails-exhausted', s.exhausted + ' confirmation email(s) failed 5 times',
      'These registrants never received the copy of their details by email (they did see the confirmation on screen). ' +
      'Check the Gmail account and SMTP_PASS, then reset email_attempts to 0 for those rows in Supabase to retry.');
  }
  if (deferred > 0) {
    alert_('gmail-daily-limit', "Gmail's daily sending limit was reached",
      deferred + ' confirmation email(s) are waiting. The church Gmail (shared with The Awakening) can send about ' +
      '500 emails a day. They are retried every hour until Gmail allows sending again; nothing needs doing ' +
      'unless this lasts more than a day.');
  }
  if (s.failed - deferred >= 10) {
    alert_('emails-failing', (s.failed - deferred) + ' confirmation emails are failing',
      'The app password may have changed or Gmail is refusing mail. They keep retrying every 5 minutes (5 attempts).');
  }
  if (s.last_hour > SPIKE_PER_HOUR) {
    alert_('registration-spike', s.last_hour + ' registrations in the last hour',
      'Unusually many sign-ups. If this is outreach working, great. If the names look fake, it may be a bot: ' +
      'check the Sheet, and consider enabling extra protection.');
  }
  if (s.unsynced_oldest_minutes > 30) {
    alert_('sync-stalled', 'Sheet copy is ' + s.unsynced_oldest_minutes + ' minutes behind',
      s.unsynced + ' registration(s) are not in the Sheet yet. Try Wives Hangout → Sync now; check the Log tab.');
  }
  if (!isDev_() && s.logged > 0) {
    alert_('logged-in-live', 'Production emails are in log mode',
      s.logged + ' production registration(s) had their email only logged, not sent. Set EMAIL_MODE=smtp in Vercel Production.');
  }
}

/** Daily summary at about 7am (trigger from installTrigger). */
function dailyDigest() {
  var props = PropertiesService.getScriptProperties();
  var to = props.getProperty('ALERT_EMAIL');
  if (!to) return;
  var s = rpc_('ops_summary', { p_event: slug_() });
  MailApp.sendEmail(to, PREFIX + 'Daily summary: ' + s.total + ' registered (+' + s.last_24h + ' in 24h)', [
    'Event: ' + slug_(),
    '',
    'Total registrations: ' + s.total,
    'New in the last 24 hours: ' + s.last_24h,
    'Need to bring a child: ' + s.bringing_child,
    '',
    'Emails sent: ' + s.sent,
    'Emails failing (still retrying): ' + s.failed,
    "Emails waiting for Gmail's daily limit: " + s.deferred,
    'Emails failed 5 times (need attention): ' + s.exhausted,
    'Emails only logged (test mode): ' + s.logged,
    '',
    'Not yet in the Sheet: ' + s.unsynced,
  ].join('\n'));
}

function alert_(key, subject, body) {
  var to = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL');
  if (!to) return;
  var cache = CacheService.getScriptCache();
  if (cache.get('alert:' + key)) return;
  try {
    MailApp.sendEmail(to, PREFIX + subject, body);
    cache.put('alert:' + key, '1', ALERT_REPEAT_SECONDS);
  } catch (err) {
    log_('error', 'alert', String(err));
  }
}

function cell_(header, value) {
  if (value === null || value === undefined) return '';
  var s = String(value);
  if (FORCE_TEXT[header]) return "'" + s;
  // Formula guard: never let user input be evaluated by Sheets.
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function rpc_(fn, body) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  var headers = { apikey: key };
  // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys don't.
  if (key && key.indexOf('sb_') !== 0) headers.Authorization = 'Bearer ' + key;

  var res = UrlFetchApp.fetch(props.getProperty('SUPABASE_URL') + '/rest/v1/rpc/' + fn, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error(fn + ' failed: HTTP ' + code + ' ' + res.getContentText().slice(0, 200));
  var text = res.getContentText();
  return text ? JSON.parse(text) : null;
}

function pingRetry_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('RETRY_URL');
  if (!url) return;
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { Authorization: 'Bearer ' + props.getProperty('RETRY_SECRET') },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) log_('warn', 'pingRetry', 'HTTP ' + res.getResponseCode());
  } catch (err) {
    log_('warn', 'pingRetry', String(err));
  }
}

function log_(level, action, message) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log')
      .appendRow([new Date(), level, action, String(message).slice(0, 500)]);
  } catch (ignored) { /* logging must never break a run */ }
}

/**
 * Meal selection (/menu, migration 003): rewrites two tabs from Supabase each run (a full snapshot,
 * ~200 rows): "Meals" (seat, who, what, and the code servers check on the screenshot) and
 * "Meal totals" (per dish, for the kitchen). Runs on its own 5-minute trigger, so it can never
 * hold up the registrations sync. Returns the number of meals written.
 */
// seat_no first (migration 006): sorted by seat in SQL so servers can find people seat by seat.
var MEAL_HEADERS = ['seat_no', 'full_name', 'dish', 'code', 'phone', 'chosen_at'];
var TOTAL_HEADERS = ['dish', 'quantity', 'chosen', 'remaining'];

function syncMeals() {
  try {
    var meals = rpc_('meal_list', { p_event: slug_() }) || [];
    var menu = rpc_('menu_status', { p_event: slug_() }) || [];
    var suffix = isDev_() ? ' (DEV)' : '';
    writeTab_('Meals' + suffix, MEAL_HEADERS, meals.map(function (m) {
      return MEAL_HEADERS.map(function (h) { return cell_(h, m[h]); });
    }));
    var totals = menu.map(function (m) { return [m.name, m.quantity, m.quantity - m.remaining, m.remaining]; });
    var sum = function (i) { return totals.reduce(function (n, r) { return n + r[i]; }, 0); };
    totals.push(['TOTAL', sum(1), sum(2), sum(3)]);
    writeTab_('Meal totals' + suffix, TOTAL_HEADERS, totals);
    return meals.length;
  } catch (err) {
    log_('error', 'syncMeals', String(err));
    return null;
  }
}

function writeTab_(name, headers, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();
  var values = [headers].concat(rows);
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
