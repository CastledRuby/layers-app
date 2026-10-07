// Turning on sync through OneDrive (Me): the passphrase, typed twice for a
// new sync file, or once to open the one another device made. onTurnOn
// resolves to null when it worked, or what went wrong, shown here.
// Keys: the passphrase box is ready to type in, Tab (or Enter) goes to the
// next, Enter turns it on.

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { COLORS } from '../theme.js';

export const MIN_PASSPHRASE = 8;

export function SyncSheet({ hasFile, folder, onClose, onTurnOn }) {
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const short = pass.length < MIN_PASSPHRASE;
  const mismatch = !hasFile && again && again !== pass;
  const ready = !busy && !short && (hasFile || again === pass);

  async function turnOn() {
    if (!ready) return;
    setBusy(true); setError(null);
    const problem = await onTurnOn(pass);
    setBusy(false);
    if (problem) setError(problem);
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter') { e.preventDefault(); turnOn(); }
    else if (e.key.toLowerCase() === 'p') { e.preventDefault(); const el = document.getElementById('sync-pass'); if (el) el.focus(); }
  }
  const field = { type: 'password', autoComplete: 'off', spellCheck: false, className: 'w-full text-sm rounded-xl px-3 py-2.5', style: { border: `1px solid ${COLORS.line}` } };

  return (
    <Sheet title="Sync through OneDrive" onClose={onClose} onKey={onKey}
      footer={<button type="button" onClick={turnOn} disabled={!ready} className="primary-btn">{busy ? 'Syncing…' : hasFile ? 'Open it and sync' : 'Turn on sync'} <Kbd onAccent>↵</Kbd></button>}>
      <p className="text-sm" style={{ color: COLORS.ink }}>
        {hasFile
          ? 'Another device has started syncing already. Type the passphrase you chose there.'
          : 'Layers keeps one encrypted copy of your data in OneDrive, so your other computers (and, later, your phone) stay the same. Choose a passphrase to lock it.'}
      </p>
      <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: COLORS.inkSoft }}>
        <Lock size={12} className="shrink-0" style={{ marginTop: 2 }} />
        <span>Without the passphrase the file can't be read, by Microsoft or anyone else, and Layers can't get it back for you, so keep it somewhere safe. This laptop remembers it, protected by Windows. The file is in {folder}.</span>
      </p>
      <p className="text-xs font-bold mt-4 mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Passphrase</p>
      <KeyedField letter="P" id="sync-pass" autoFocus value={pass} onChange={e => { setPass(e.target.value); setError(null); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (hasFile) turnOn(); else { const el = document.getElementById('sync-again'); if (el) el.focus(); } } }}
        aria-label="Passphrase" placeholder={`At least ${MIN_PASSPHRASE} characters; a few words is good`} {...field} />
      {!hasFile && (
        <>
          <p className="text-xs font-bold mt-3 mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Again</p>
          <input id="sync-again" value={again} onChange={e => { setAgain(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); turnOn(); } }}
            aria-label="Passphrase again" placeholder="The same again" {...field} />
        </>
      )}
      <p className="text-xs mt-2" role="status" style={{ color: error || mismatch ? COLORS.alert : COLORS.inkSoft }}>
        {error || (mismatch ? "The two don't match yet." : pass && short ? `${MIN_PASSPHRASE - pass.length} more characters.` : '')}
      </p>
    </Sheet>
  );
}
