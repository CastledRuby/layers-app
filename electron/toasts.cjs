// Windows toast notifications for the calendar, scheduled with Windows ahead
// of time so they arrive even when Layers is closed. The renderer works out
// what to notify (src/lib/calendar.js plannedNotifications); this turns each
// into toast XML with buttons and hands the lot to Windows.
//
// Buttons are layers:// links (registered as Layers' protocol by the
// installer). Windows opens Layers with the link, and main.cjs passes it to
// the renderer, which does the action: snooze, log it, tick it off or open.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GROUP = 'layers';
const MAX_TOASTS = 400;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (action, params) => `layers://${action}?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString()}`;

// One planned notification ({ kind, title, body, eventId?, day? }) as toast XML.
// - A reminder (alert, snooze), before or at the start: snooze 10 minutes,
//   1 hour or until tomorrow. Nothing has happened yet, so there's no Log it
//   or Done; those wait for "How did it go?". It uses the reminder scenario,
//   so it stays on screen.
// - "How did it go?" (after): Log it, or Just tick it.
// - A birthday or key date coming up (date): Plan something, with them on
//   that day.
// - Summaries (morning, evening): clicking opens that day.
function toastXml(n) {
  const ids = { e: n.eventId, d: n.day };
  const button = (content, action, extra = {}) => `<action content="${esc(content)}" activationType="protocol" arguments="${esc(link(action, { ...ids, ...extra }))}"/>`;
  let actions = '';
  let scenario = '';
  if ((n.kind === 'alert' || n.kind === 'snooze') && n.eventId) {
    scenario = ' scenario="reminder"';
    actions = button('10 min', 'snooze', { m: '10' }) + button('1 hour', 'snooze', { m: '60' }) + button('Tomorrow', 'snooze', { m: 'tomorrow' });
  } else if (n.kind === 'after' && n.eventId) {
    actions = button('Log it', 'log') + button('Just tick it', 'done');
  } else if (n.kind === 'date' && n.personId) {
    actions = button('Plan something', 'plan', { p: n.personId });
  }
  return `<toast activationType="protocol" launch="${esc(link('open', ids))}"${scenario}>`
    + `<visual><binding template="ToastGeneric"><text>${esc(n.title)}</text><text>${esc(n.body)}</text></binding></visual>`
    + (actions ? `<actions>${actions}</actions>` : '')
    + '</toast>';
}

// Only well-formed entries in the future, at most MAX_TOASTS, with tags
// short enough for Windows (64 characters).
function cleanList(list, now = Date.now()) {
  return (Array.isArray(list) ? list : [])
    .filter(n => n && typeof n.tag === 'string' && n.tag.length <= 64 && typeof n.at === 'number' && isFinite(n.at) && n.at > now + 5000 && typeof n.title === 'string')
    .slice(0, MAX_TOASTS)
    .map(n => ({ tag: n.tag, at: Math.round(n.at), xml: toastXml(n) }));
}

// Windows PowerShell can reach the WinRT notification API without a native
// module: remove Layers' previously scheduled toasts, then schedule the new set.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:LAYERS_AUMID)
foreach ($old in @($notifier.GetScheduledToastNotifications())) { if ($old.Group -eq '${GROUP}') { $notifier.RemoveFromSchedule($old) } }
$items = Get-Content -Raw -Encoding UTF8 $env:LAYERS_TOASTS | ConvertFrom-Json
$count = 0
foreach ($it in @($items)) {
  if ($null -eq $it) { continue }
  $doc = [Windows.Data.Xml.Dom.XmlDocument]::new()
  $doc.LoadXml($it.xml)
  $toast = [Windows.UI.Notifications.ScheduledToastNotification]::new($doc, [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$it.at))
  $toast.Tag = $it.tag
  $toast.Group = '${GROUP}'
  $notifier.AddToSchedule($toast)
  $count++
}
Write-Output "scheduled $count"
`;

// Replaces Layers' scheduled toasts with `list`. Resolves { scheduled } or
// { error }. LAYERS_SCHEDULE_DUMP writes the list to that file instead (the
// end-to-end tests), and LAYERS_NO_SCHEDULE turns it off.
function scheduleToasts(list, { aumid, env = process.env } = {}) {
  const items = cleanList(list);
  if (env.LAYERS_NO_SCHEDULE) return Promise.resolve({ scheduled: 0, skipped: 'LAYERS_NO_SCHEDULE' });
  if (env.LAYERS_SCHEDULE_DUMP) {
    fs.writeFileSync(env.LAYERS_SCHEDULE_DUMP, JSON.stringify(items, null, 2));
    return Promise.resolve({ scheduled: items.length, dumped: true });
  }
  if (process.platform !== 'win32') return Promise.resolve({ scheduled: 0, skipped: 'not Windows' });
  const file = path.join(os.tmpdir(), `layers-toasts-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(file, JSON.stringify(items));
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], {
      env: { ...env, LAYERS_AUMID: aumid, LAYERS_TOASTS: file },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => resolve({ error: e.message }));
    child.on('exit', (code) => {
      fs.rm(file, { force: true }, () => {});
      const m = out.match(/scheduled (\d+)/);
      resolve(code === 0 && m ? { scheduled: Number(m[1]) } : { error: (err || out || `exit ${code}`).trim().slice(0, 500) });
    });
  });
}

// Runs one schedule at a time; while one runs, only the newest waiting list
// is kept, since it replaces everything anyway.
function createScheduler(options) {
  let running = false;
  let waiting = null;
  let last = null;
  async function run(list) {
    if (running) { waiting = list; return { queued: true }; }
    running = true;
    try {
      last = await scheduleToasts(list, options);
      return last;
    } finally {
      running = false;
      if (waiting) { const next = waiting; waiting = null; run(next); }
    }
  }
  return { run, last: () => last };
}

module.exports = { toastXml, cleanList, scheduleToasts, createScheduler, GROUP };
