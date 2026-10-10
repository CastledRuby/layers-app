// Analyse all new, in Coach's Analyse above "From your chats" (lib/chatBatch.js,
// run by useChatBatch in LayersApp): what's new and roughly what sending it
// costs, then "reading 3 of 9", and the answers waiting to be reviewed.

import { Kbd } from './atoms.jsx';
import { analysisModel, spendSummary } from '../lib/analysis.js';
import { batchDollars, readLimit, TINY } from '../lib/chatBatch.js';
import { COLORS } from '../theme.js';

const money = (d) => (d < 0.01 ? 'under US$0.01' : `about US$${d.toFixed(2)}`);
const listOf = (names) => (names.length <= 1 ? names.join('') : names.length <= 3 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`);

// plan: batchPlan's { items, people, noOwner }, or null while the folder is
// read. batch: { running, note, waiting, stop }.
export function ChatBatchCard({ plan, batch, model, people, onStart, onReview }) {
  const { running, note, waiting } = batch;
  const items = plan ? plan.items : [];
  const sending = items.filter(i => !i.tiny);
  const tiny = items.length - sending.length;
  if (!running && !items.length && !waiting.length && !note) return null;
  const names = (plan ? plan.people : []).map(id => people.find(p => p.id === id)).filter(Boolean).map(p => p.name.split(' ')[0]);
  const cost = batchDollars(items, model);
  const limit = readLimit();
  const spent = spendSummary().thisMonth.dollars;
  return (
    <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Analyse all new">
      {running ? (
        <>
          <div className="flex items-center gap-2.5" role="status">
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${COLORS.line}`, borderTopColor: COLORS.accent }} className="spin shrink-0" />
            <p className="text-sm flex-1" style={{ color: COLORS.ink }}>{analysisModel(running.model).short} is reading {Math.min(running.done + 1, running.total)} of {running.total}…</p>
            <button type="button" onClick={batch.stop} className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Stop</button>
          </div>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Use the rest of Layers meanwhile; each answer waits here to be reviewed.</p>
        </>
      ) : items.length > 0 && (
        <>
          <button type="button" onClick={onStart} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Analyse all new <Kbd onAccent>A</Kbd></button>
          <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
            {sending.length > 0 && `${sending.length} ${sending.length === 1 ? 'conversation' : 'conversations'} with ${listOf(names)} (a day with someone each), ${money(cost)} with ${analysisModel(model).short}. Each is sent to Anthropic the way Analyse sends one, names swapped for tags first. `}
            {tiny > 0 && `${tiny} tiny ${tiny === 1 ? 'one' : 'ones'} (under ${TINY} written messages, or only one side writing) ${tiny === 1 ? 'is' : 'are'} marked as seen without sending.`}
          </p>
          {limit > 0 && sending.length > 0 && spent + cost > limit && <p className="text-xs mt-1.5 font-semibold" style={{ color: COLORS.warn }}>That's more than is left of your US${limit} monthly limit ({money(spent)} spent), so it stops partway.</p>}
        </>
      )}
      {!running && plan && plan.noOwner.length > 0 && <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Left out until you say which name is you, below: {plan.noOwner.join(', ')}.</p>}
      {!running && note && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: COLORS.alert }}>{note}</p>}
      {waiting.length > 0 && <button type="button" onClick={onReview} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5 mt-2.5" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Ready to review ({waiting.length}) <Kbd>R</Kbd></button>}
    </div>
  );
}
