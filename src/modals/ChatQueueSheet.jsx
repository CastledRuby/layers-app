// "Ready to review": the answers from Analyse all new (lib/chatBatch.js), one
// at a time, oldest first. Each is a log ready to save, like Analyse's Log it,
// with the details Claude found. Keys: Enter logs it and saves its details,
// X skips it (nothing logged), E opens the full review (ChatReviewSheet), B
// reminds you the day after its details that have a day, 1-9 leave a detail
// out (or put it back), ← → the one before or after, and Shift+Enter logs all.

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { ConvStateBadge, Kbd } from '../components/atoms.jsx';
import { AvatarStack } from '../components/PersonPick.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { categoryMeta, DIM_LABELS, DIM_ORDER, ML_LABELS } from '../data/constants.js';
import { analysisModel, analysisToKeep } from '../lib/analysis.js';
import { formatCalendarDate, parseISODay } from '../lib/dates.js';
import { ChatReviewSheet } from './ChatReviewSheet.jsx';
import { COLORS } from '../theme.js';

const SOURCE = { whatsapp: 'WhatsApp', instagram: 'Instagram' };

// items: what's waiting (lib/chatBatch.js, waiting). onLog(items, leaveOut)
// logs them ({ [item id]: [detail indexes] } left unsaved), onSkip(item),
// onRemind(item).
export function ChatQueueSheet({ items, people, onLog, onSkip, onRemind, onClose }) {
  const [index, setIndex] = useState(0);
  const [leaveOut, setLeaveOut] = useState({});
  const [full, setFull] = useState(false);
  const at = Math.max(0, Math.min(index, items.length - 1));
  const item = items[at];
  if (!item) return null;
  const who = item.personIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const r = item.result;
  const out = leaveOut[item.id] || [];
  const answered = items.filter(x => x.result);
  const dated = r ? r.extractedInfo.filter(it => it.when) : [];
  const m = r ? r.log.meaningfulness : 3;

  const log = () => { if (r) onLog([item], leaveOut); };
  const logAll = () => { if (answered.length) onLog(answered, leaveOut); };
  const skip = () => onSkip(item);
  const remind = () => { if (dated.length && !item.reminded) onRemind(item); };
  const toggle = (i) => setLeaveOut(all => { const cur = all[item.id] || []; return { ...all, [item.id]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] }; });
  const move = (by) => setIndex(Math.max(0, Math.min(items.length - 1, at + by)));

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    const act = (fn) => { e.preventDefault(); fn(); };
    if (e.key === 'Enter' && e.shiftKey) act(logAll);
    else if (e.key === 'Enter') act(log);
    else if (key === 'x') act(skip);
    else if (key === 'e' && r) act(() => setFull(true));
    else if (key === 'b') act(remind);
    else if (e.key === 'ArrowLeft') act(() => move(-1));
    else if (e.key === 'ArrowRight') act(() => move(1));
    else if (/^[1-9]$/.test(e.key) && r && Number(e.key) <= r.extractedInfo.length) act(() => toggle(Number(e.key) - 1));
  }

  const footer = r ? (
    <div className="flex items-center gap-2">
      <button type="button" onClick={log} className="primary-btn" style={{ flex: 2 }}>Log it <Kbd onAccent>↵</Kbd></button>
      {answered.length > 1 && <button type="button" onClick={logAll} className="flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-3" style={{ flex: 1, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Log all {answered.length} <Kbd>⇧↵</Kbd></button>}
    </div>
  ) : (
    <button type="button" onClick={skip} className="primary-btn">Skip it <Kbd onAccent>X</Kbd></button>
  );

  return (
    <>
      <Sheet title="Ready to review" onClose={onClose} onKey={onKey} tall footer={footer}>
        <div className="flex items-center gap-1 -mt-2 mb-3">
          <button type="button" onClick={() => move(-1)} disabled={at === 0} aria-label="The one before" className="icon-btn -ml-2"><ChevronLeft size={18} color={COLORS.inkSoft} /></button>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>{at + 1} of {items.length}</p>
          <button type="button" onClick={() => move(1)} disabled={at === items.length - 1} aria-label="The one after" className="icon-btn"><ChevronRight size={18} color={COLORS.inkSoft} /></button>
        </div>

        <div className="flex items-center gap-3">
          {who.length > 0 && <AvatarStack people={who} size={34} />}
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{who.map(p => p.name).join(', ') || item.title}</p>
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>{SOURCE[item.source] || 'Chat'} · {item.title} · {formatCalendarDate(parseISODay(item.day))}{item.messages ? ` · ${item.messages} messages` : ''}</p>
          </div>
        </div>

        {!r ? (
          <p className="text-sm mt-4 rounded-xl p-3" role="alert" style={{ background: COLORS.paperRaised, color: COLORS.alert }}>Claude couldn't finish this one: {item.error} Skip it; you can still analyse it on its own from its chat's earlier conversations.</p>
        ) : (
          <>
            <div className="rounded-2xl p-3.5 mt-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between gap-2">
                <ConvStateBadge stateKey={r.conversationState} />
                <span className="font-display" style={{ fontSize: 22, color: COLORS.accent }} aria-label={`Overall ${r.grading.overall}%`}>{r.grading.overall}%</span>
              </div>
              <p className="text-xs mt-2.5" style={{ color: COLORS.ink }}>📱 Messaged · {ML_LABELS[m - 1]} ({m} of 5)</p>
              {DIM_ORDER.some(k => r.log.ratings[k]) && <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{DIM_ORDER.filter(k => r.log.ratings[k]).map(k => `${DIM_LABELS[k]} ${r.log.ratings[k]}`).join(' · ')}</p>}
              {r.log.summary && <p className="text-xs mt-1.5 italic" style={{ color: COLORS.inkSoft }}>Note: {r.log.summary}</p>}
              {r.tryNextTime && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}><span className="font-semibold" style={{ color: COLORS.ink }}>Try next time:</span> {r.tryNextTime}</p>}
            </div>

            {r.extractedInfo.length > 0 && (
              <>
                <p className="text-sm font-semibold mt-4 mb-1.5" style={{ color: COLORS.ink }}>Details to save <span className="text-xs font-normal" style={{ color: COLORS.inkSoft }}>· 1–9 leaves one out</span></p>
                <div className="flex flex-col gap-1">
                  {r.extractedInfo.map((it, i) => {
                    const left = out.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => toggle(i)} aria-pressed={!left} className="flex items-start gap-2 rounded-xl px-2.5 py-2 text-left" style={{ background: COLORS.paperRaised, opacity: left ? 0.5 : 1 }}>
                        {i < 9 && <Kbd>{i + 1}</Kbd>}
                        <span aria-hidden="true">{categoryMeta(it.category).emoji}</span>
                        <span className="text-xs flex-1" style={{ color: COLORS.ink, textDecoration: left ? 'line-through' : 'none' }}>
                          {it.text}{it.when ? ` · 🗓️ ${formatCalendarDate(parseISODay(it.when))}` : ''}{it.name ? <span style={{ color: COLORS.inkSoft }}> · about {it.name}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-4">
          {r && <button type="button" onClick={skip} className="chip">Skip <Kbd>X</Kbd></button>}
          {r && <button type="button" onClick={() => setFull(true)} className="chip">Full review <Kbd>E</Kbd></button>}
          {dated.length > 0 && (item.reminded
            ? <span className="text-xs" style={{ color: COLORS.good }}>✓ Reminders set</span>
            : <button type="button" onClick={remind} className="chip">Remind me after <Kbd>B</Kbd></button>)}
        </div>
        {r && <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Read by {analysisModel(item.model).name}. Logging keeps this review and the chat with the log; skipping logs nothing.</p>}
      </Sheet>
      {full && r && <ChatReviewSheet entry={{ at: item.day, analysis: analysisToKeep(r, { model: item.model, chat: item.chat }) }} person={who[0]} onClose={() => setFull(false)} />}
    </>
  );
}
