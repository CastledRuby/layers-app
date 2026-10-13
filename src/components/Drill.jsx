// A practice drill (lib/drills.js, decided 2026-10-10): their tricky message,
// your reply (↵ sends, Shift+↵ a new line), then Claude's score, what worked
// and a reply that lands better, in your style. On Today ("Today's drill", R
// to reply) until you've done one, and in Coach → Practise with Another.
// Each one done is kept for Me's chart as practice, and as done today.

import { forwardRef, useState } from 'react';
import { Check } from 'lucide-react';
import { ChatBubble, Kbd } from './atoms.jsx';
import { analysisModel, recordSpend } from '../lib/analysis.js';
import { drillRequest, drillResult, saveDrill } from '../lib/drills.js';
import { addPractice } from '../lib/practice.js';
import { yourSamples } from '../lib/replies.js';
import { toISODate } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const card = { background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` };

// done: this drill's saved result ({ reply, score, worked, better, why }), if
// it's been done. onDone(saved drills) after one's done; onAnother and onMore
// are buttons under the result. boxKey shows the key that reaches the box.
export const Drill = forwardRef(function Drill({ drill, title, people = [], journal = [], yourName = '', style = '', model, onAnalyse, done = null, onDone, onAnother, onMore, boxKey = null }, box) {
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const result = done;

  async function send() {
    const reply = draft.trim();
    if (!reply || asking || !onAnalyse) return;
    setAsking(true); setError(null);
    // Your style with someone like them: a close friend, or a newer one.
    const samples = yourSamples({ journal, yourName, people, layer: /close/.test(drill.who || '') ? 4 : 2 });
    const answer = await Promise.resolve(onAnalyse(drillRequest({ drill, reply, everyone: people, yourName, samples, style, model }))).catch(() => null);
    if (answer && answer.usage) recordSpend(answer.usage, answer.model || model);
    setAsking(false);
    const r = answer && answer.result ? drillResult(answer.result) : null;
    if (!r) { setError((answer && answer.error) || "Couldn't get feedback. Try sending it again."); return; }
    const day = toISODate(new Date());
    if (r.score !== null) addPractice({ at: day, situation: 'drill', drill: drill.key, grading: { overall: r.score } });
    setDraft('');
    if (onDone) onDone(saveDrill(day, drill.key, reply, r));
  }
  function copyBetter() {
    if (!result || !navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(result.better).then(() => setCopied(true)).catch(() => {});
  }

  return (
    <div className="rounded-2xl p-3.5" style={card} aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: COLORS.ink }}>{title}{boxKey && !result && <Kbd>{boxKey}</Kbd>}</p>
        {result && result.score !== null && <span className="font-display" style={{ fontSize: 20, color: COLORS.accent }} aria-label="Score">{result.score}</span>}
      </div>
      <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>{drill.name}, {drill.who}. Your aim: {drill.aim}.</p>
      <ChatBubble who="them" text={drill.text} name={drill.name} />
      {result ? (
        <>
          {result.reply && <ChatBubble who="you" text={result.reply} />}
          {result.worked && <p className="text-xs mt-1" style={{ color: COLORS.good }}>✓ {result.worked}</p>}
          <p className="text-xs font-semibold mt-2.5 mb-1" style={{ color: COLORS.ink }}>A reply that lands better</p>
          <p className="text-sm rounded-xl px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.ink }} aria-label="Better reply">{result.better}</p>
          {result.why && <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{result.why}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <button type="button" onClick={copyBetter} className="chip">{copied ? <><Check size={12} color={COLORS.good} />Copied</> : 'Copy it'}</button>
            {onAnother && <button type="button" onClick={onAnother} className="text-xs font-semibold rounded-full px-3.5 py-2" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Another</button>}
            {onMore && <button type="button" onClick={onMore} className="chip">More in Practise</button>}
          </div>
        </>
      ) : (
        <>
          <textarea ref={box} value={draft} onChange={e => setDraft(e.target.value)} aria-label="Your reply" rows={2} placeholder={`Reply to ${drill.name}`} disabled={asking}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); send(); } }}
            className="w-full text-sm rounded-xl px-3 py-2.5 mt-1" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />
          {error && <p className="text-xs mt-1 font-semibold" role="alert" style={{ color: COLORS.alert }}>{error}</p>}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>{asking ? 'Claude is reading your reply…' : `Your reply goes to ${analysisModel(model).name} for a score and a better one, in your style: under a cent.`}</p>
            <button type="button" onClick={send} disabled={!draft.trim() || asking} className="shrink-0 flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-2" style={{ background: COLORS.accent, color: COLORS.onAccent, opacity: !draft.trim() || asking ? 0.5 : 1 }}>
              Send <Kbd onAccent>↵</Kbd>
            </button>
          </div>
        </>
      )}
    </div>
  );
});
