// Where the faces are in pictures, using Windows' own face detector
// (Windows.Media.FaceAnalysis, the one the Photos app uses), so a photo's
// circle can start on the face. Nothing is bundled and nothing leaves the
// computer: a short PowerShell script asks Windows, once for a whole folder.
// See docs/electron.md.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_FILES = 300;
const PICTURE = /\.(jpe?g|png|webp|gif|bmp)$/i;

// Reads "index<TAB>path" lines on standard input; writes one JSON line per
// picture it could read: { i, width, height, faces: [{ x, y, w, h }] }.
const SCRIPT = `
[Console]::InputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.FaceAnalysis.FaceDetector, Windows.Media, ContentType = WindowsRuntime] | Out-Null
$detector = Await ([Windows.Media.FaceAnalysis.FaceDetector]::CreateAsync()) ([Windows.Media.FaceAnalysis.FaceDetector])
foreach ($line in ([Console]::In.ReadToEnd() -split "\`r?\`n")) {
  if (-not $line.Trim()) { continue }
  $parts = $line -split "\`t", 2
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($parts[1])) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $gray = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($bitmap, [Windows.Graphics.Imaging.BitmapPixelFormat]::Gray8)
    $found = Await ($detector.DetectFacesAsync($gray)) ([System.Collections.Generic.IList[Windows.Media.FaceAnalysis.DetectedFace]])
    $faces = @($found | ForEach-Object { @{ x = $_.FaceBox.X; y = $_.FaceBox.Y; w = $_.FaceBox.Width; h = $_.FaceBox.Height } })
    @{ i = [int]$parts[0]; width = $bitmap.PixelWidth; height = $bitmap.PixelHeight; faces = $faces } | ConvertTo-Json -Compress -Depth 4
    $stream.Dispose()
  } catch { }
}
`;

// Only absolute paths to picture files that exist; anything else is null.
function cleanPaths(paths) {
  return (Array.isArray(paths) ? paths : []).slice(0, MAX_FILES)
    .map(p => (typeof p === 'string' && path.isAbsolute(p) && PICTURE.test(p) && fs.existsSync(p) ? p : null));
}

// The script's output as one entry per picture asked about, in order:
// { width, height, faces: [{ x, y, w, h }] }, or null where it couldn't read one.
function parseFaces(stdout, count) {
  const out = Array(count).fill(null);
  String(stdout).split(/\r?\n/).forEach(line => {
    let d = null;
    try { d = JSON.parse(line); } catch { return; }
    if (!d || !Number.isInteger(d.i) || d.i < 0 || d.i >= count || !(d.width > 0) || !(d.height > 0)) return;
    const list = Array.isArray(d.faces) ? d.faces : d.faces ? [d.faces] : [];
    const faces = list.filter(f => f && [f.x, f.y, f.w, f.h].every(n => typeof n === 'number' && n >= 0) && f.w > 0 && f.h > 0)
      .map(({ x, y, w, h }) => ({ x, y, w, h }));
    out[d.i] = { width: d.width, height: d.height, faces };
  });
  return out;
}

// paths: the pictures, as files on this computer. Resolves to parseFaces'
// list; all null when it isn't Windows, nothing could be read, or Windows
// took longer than timeoutMs. `run` is spawn, replaced in tests.
function findFaces(paths, { run = spawn, timeoutMs = 30000, platform = process.platform } = {}) {
  const list = cleanPaths(paths);
  const lines = list.map((p, i) => (p ? `${i}\t${p}` : null)).filter(Boolean);
  if (!lines.length || platform !== 'win32') return Promise.resolve(list.map(() => null));
  return new Promise((resolve) => {
    let out = '';
    let done = false;
    let child = null;
    let timer = null;
    // Only answers about pictures that were asked about.
    const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(parseFaces(out, list.length).map((r, i) => (list[i] ? r : null))); };
    try {
      child = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], { windowsHide: true });
    } catch {
      resolve(list.map(() => null));
      return;
    }
    timer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } finish(); }, timeoutMs);
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('error', finish);
    child.on('close', finish);
    child.stdin.on('error', () => {});
    child.stdin.end(lines.join('\n'), 'utf8');
  });
}

module.exports = { cleanPaths, findFaces, parseFaces, SCRIPT };
