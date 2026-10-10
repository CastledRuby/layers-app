// Coach → What to say (decided 2026-10-10): three replies to their latest
// messages, written by Claude in your own style (lib/replies.js), with a line
// on what they seem to want. The messages are pasted, or picked from your
// chats (`chatsList`, or Reply ideas on a chat in Analyse, `start`). Nothing
// is sent until you press Suggest replies. Keys: Ctrl+Enter in the box asks;
// Q, W and E copy the natural, playful and deeper reply.

import { useEffect, useState } from 'react';
import { Check, Copy, Plus, X } from 'lucide-react';
import { Avatar, Kbd } from './atoms.jsx';
import { hasOpenSheet, isTyping } from './sheetLayer.js';
import { getLayer } from '../data/constants.js';
import { analysisModel, detectPeople, recordSpend } from '../lib/analysis.js';
import { chatPeople, conversationLabel, conversationText, sourceLabel } from '../lib/chatImport.js';
import { replyRequest, replyResult, styleSamples } from '../lib/replies.js';
import { COLORS } from '../theme.js';

const KINDS = [['natural', 'Natural', 'q'], ['playful', 'Playful', 'w'], ['deeper', 'Deeper', 'e']];
const RECENT = 30; // the latest messages of a conversation, enough to reply to

// A conversation from your chats as the box's text: its latest messages with
// exact times, you under your name, and who it's with.
function fromChat({ chat, conv, owner }, people, yourName) {
  const { ids, nameFor } = chatPeople(chat, people, owner);
  return { ids, text: conversationText({ ...conv, messages: conv.messages.slice(-RECENT) }, { owner, yourName, nameFor }), label: `${sourceLabel(chat.source)} · ${chat.title} · ${conversationLabel(conv)}` };
}

// start: { chat, conv, owner } from Reply ideas on a chat, or null. ready:
// 'none' | 'no-key' | 'ready', as Analyse. onAnalyse sends a request through
// the main process. chatsList(pick): "From your chats" with picking wired in.
export function ReplyIdeas({ people, journal, yourName = '', style = '', ready = 'none', onAnalyse, model, onOpenMe, start = null, chatsList = null }) {
  const first = start ? fromChat(start, people, yourName) : null;
  const [text, setText] = useState(first ? first.text : '');
  const [withIds, setWithIds] = useState(first && first.ids.length ? first.ids : null);
  const [picking, setPicking] = useState(false);
  const [source, setSource] = useState(first ? first.label : null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(null);
  const withPeople = (withIds || detectPeople(text, people, yourName)).map(id => people.find(p => p.id === id)).filter(Boolean);
  const canAsk = ready === 'ready' && withPeople.length > 0 && text.trim() && !asking;

  function pick(chat, conv, owner) {
    const f = fromChat({ chat, conv, owner }, people, yourName);
    setText(f.text); setWithIds(f.ids.length ? f.ids : null); setSource(f.label); setResult(null); setError(null);
  }
  async function ask() {
    if (!canAsk) return;
    setAsking(true); setError(null);
    const request = replyRequest({ people: withPeople, everyone: people, yourName, text, samples: styleSamples(journal, yourName), style, model });
    const answer = await Promise.resolve(onAnalyse(request)).catch(() => null);
    if (answer && answer.usage) recordSpend(answer.usage, answer.model || model);
    setAsking(false);
    if (!answer || answer.error || !answer.result) { setError((answer && answer.error) || "Couldn't get reply ideas."); return; }
    setResult(replyResult(answer.result, withPeople));
    setCopied(null);
    // Out of the box, so Q, W and E copy straight away.
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') document.activeElement.blur();
  }
  function copy(kind) {
    const value = result && result[kind];
    if (!value || !navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(value).then(() => setCopied(kind)).catch(() => {});
  }
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || hasOpenSheet() || isTyping() || !result) return;
      const kind = KINDS.find(k => k[2] === e.key.toLowerCase());
      if (kind && result[kind[0]]) { e.preventDefault(); copy(kind[0]); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (ready !== 'ready') {
    return (
      <div className="rounded-2xl p-3.5" style={{ background: COLORS.paperRaised, border: `1px dashed ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Reply ideas</p>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{ready === 'none' ? 'Reply ideas come from Claude, in the Windows app.' : 'Paste their latest messages and Claude suggests three replies in your style. It needs your Anthropic API key first, in Me.'}</p>
        {ready === 'no-key' && onOpenMe && <button type="button" onClick={onOpenMe} className="text-xs font-semibold rounded-full px-3 py-1.5 mt-2.5" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Add a key in Me</button>}
      </div>
    );
  }
  return (
    <div>
      {chatsList && chatsList(pick)}
      <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Reply ideas">
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Their latest messages</p>
        <div role="group" aria-label="Who it's with" className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-xs font-semibold mr-0.5" style={{ color: COLORS.ink }}>With</span>
          {withPeople.map(p => (
            <span key={p.id} className="chip chip--on" style={{ padding: '3px 8px 3px 4px' }}>
              <Avatar person={p} size={20} ringColor={getLayer(p.layer).color} />{p.name}
              {withPeople.length > 1 && <button type="button" onClick={() => setWithIds(withPeople.filter(x => x.id !== p.id).map(x => x.id))} aria-label={`Not with ${p.name}`} className="flex items-center"><X size={12} /></button>}
            </span>
          ))}
          {!withPeople.length && <span className="text-xs" style={{ color: COLORS.inkSoft }}>names on the messages tell Layers who, or</span>}
          {people.length > withPeople.length && <button type="button" onClick={() => setPicking(v => !v)} aria-expanded={picking} className="chip" style={{ padding: '4px 10px' }}><Plus size={12} color={COLORS.accent} />Someone{withPeople.length ? ' else' : ''}</button>}
        </div>
        {picking && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2" aria-label="Add someone">
            {people.filter(p => !withPeople.some(x => x.id === p.id)).map(p => (
              <button key={p.id} type="button" onClick={() => { setWithIds([...withPeople.map(x => x.id), p.id]); setPicking(false); }} className="chip" style={{ padding: '3px 10px 3px 4px' }}><Avatar person={p} size={20} ringColor={getLayer(p.layer).color} />{p.name}</button>
            ))}
          </div>
        )}
        {source && (
          <p className="text-xs mt-2 flex items-center gap-2" style={{ color: COLORS.inkSoft }}>
            <span className="flex-1 min-w-0">From {source}</span>
            <button type="button" onClick={() => { setSource(null); setText(''); setWithIds(null); setResult(null); }} className="font-semibold shrink-0" style={{ color: COLORS.accent }}>Clear</button>
          </p>
        )}
        <textarea value={text} onChange={e => { setText(e.target.value); setResult(null); setError(null); }} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ask(); } }}
          aria-label="Their latest messages" rows={source ? 7 : 4} placeholder={'Paste the last few messages ("Amelie: are you coming sat??"), or pick a chat above.'}
          className="w-full text-sm rounded-xl px-3 py-2.5 mt-2" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />
        <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Suggest replies sends these messages to Anthropic for {analysisModel(model).name} (under a cent), names swapped for tags, with a few of your own messages from chats you've logged{style ? ' and how you said you text' : ''}, so the replies sound like you.</p>
        {error && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: COLORS.alert }}>{error}</p>}
        <button type="button" onClick={ask} disabled={!canAsk} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5 mt-3" style={{ background: COLORS.accent, color: COLORS.onAccent, opacity: canAsk ? 1 : 0.5 }}>{asking ? `${analysisModel(model).short} is writing…` : 'Suggest replies'} {!asking && <Kbd onAccent>Ctrl+↵</Kbd>}</button>
      </div>

      {result && (
        <div aria-label="Replies">
          {result.read && <p className="text-xs mb-2 italic" style={{ color: COLORS.inkSoft }}>{result.read}</p>}
          {KINDS.filter(([k]) => result[k]).map(([k, label, key]) => (
            <div key={k} className="rounded-2xl p-3.5 mb-2 flex items-start gap-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>{label}</p>
                <p className="text-sm mt-0.5" style={{ color: COLORS.ink }}>{result[k]}</p>
              </div>
              <button type="button" onClick={() => copy(k)} aria-label={`Copy the ${label.toLowerCase()} reply`} className="chip shrink-0" style={{ padding: '4px 8px' }}>{copied === k ? <><Check size={12} color={COLORS.good} />Copied</> : <><Copy size={12} />Copy</>}<Kbd>{key.toUpperCase()}</Kbd></button>
            </div>
          ))}
          <button type="button" onClick={ask} disabled={!canAsk} className="text-xs font-semibold mt-1" style={{ color: COLORS.accent }}>Three more</button>
        </div>
      )}
    </div>
  );
}
