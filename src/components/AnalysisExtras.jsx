// What an analysis shows since 2026-10-11 (lib/analysis.js): the chat with
// Claude's moments marked on the lines they quote (good ones ✓, missed ones
// ↺), "The numbers" counted on this laptop (lib/chatNumbers.js), and last
// time's tip with whether you followed it, and a group chat's log for each
// person. Each shows nothing when there's nothing to show (the sample
// chats, or analyses from before).

import { ChatBubble } from './atoms.jsx';
import { DIM_LABELS, DIM_ORDER, ML_LABELS } from '../data/constants.js';
import { minutesText, placeMoments } from '../lib/chatNumbers.js';
import { formatCalendarDate, parseISODay } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const card = { background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` };

// A group chat's log, how it went with each person (log.each, decided
// 2026-10-12): "Sam: Personal (4 of 5) · Depth 4 · Trust 3".
export function EachLog({ each, nameOf }) {
  const ids = Object.keys(each || {});
  if (!ids.length) return null;
  return (
    <div className="mt-2" aria-label="How it went with each">
      {ids.map(id => {
        const e = each[id];
        const parts = DIM_ORDER.filter(k => e.ratings[k]).map(k => `${DIM_LABELS[k]} ${e.ratings[k]}`);
        return (
          <p key={id} className="text-xs mt-1" style={{ color: COLORS.ink }}>
            <span className="font-semibold">{nameOf(id)}</span>: {ML_LABELS[e.meaningfulness - 1]} ({e.meaningfulness} of 5){parts.length ? ` · ${parts.join(' · ')}` : ''}
          </p>
        );
      })}
    </div>
  );
}

function MomentNote({ m, align = 'left' }) {
  const good = m.kind === 'good';
  return (
    <p className="text-xs mb-2 -mt-1" style={{ color: good ? COLORS.good : COLORS.warn, textAlign: align }} aria-label={good ? 'Landed' : 'Missed'}>
      {good ? '✓' : '↺'} {m.note || (good ? 'This landed.' : 'A moment to come back to.')}
    </p>
  );
}

export function MarkedTranscript({ transcript = [], moments = [] }) {
  const { byLine, left } = placeMoments(transcript, moments);
  return (
    <>
      {transcript.map((m, i) => {
        const moment = byLine.get(i);
        if (!moment) return <ChatBubble key={i} who={m.who} text={m.text} name={m.name} />;
        return (
          <div key={i} className={`moment moment--${moment.kind}`}>
            <ChatBubble who={m.who} text={m.text} name={m.name} />
            <MomentNote m={moment} align={m.who === 'you' ? 'right' : 'left'} />
          </div>
        );
      })}
      {left.length > 0 && <MomentList moments={left} />}
    </>
  );
}

// The moments as quotes, where there's no chat to mark them on.
export function MomentList({ moments = [] }) {
  if (!moments.length) return null;
  return (
    <div aria-label="Moments">
      {moments.map((m, i) => (
        <div key={i} className="mt-2">
          <p className="text-xs italic" style={{ color: COLORS.ink }}>“{m.quote}”</p>
          <MomentNote m={m} />
        </div>
      ))}
    </div>
  );
}

const ROWS = [['Messages', 'messages'], ['Words', 'words'], ['With a question', 'questions'], ['Most in a row', 'inARow'], ['Usually answered in', 'replyMins']];
export function ChatNumbers({ numbers, theirName = 'Them' }) {
  if (!numbers) return null;
  const cell = (side, key) => (key === 'replyMins' ? minutesText(numbers[side][key]) || '–' : numbers[side][key]);
  const who = (side) => (side === 'you' ? 'You' : theirName);
  return (
    <div className="rounded-2xl p-3.5 mb-4" style={card} aria-label="The numbers">
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>The numbers</p>
      <div className="grid text-xs gap-y-1" style={{ gridTemplateColumns: '1fr auto auto', columnGap: 16 }}>
        <span />
        <span className="font-semibold text-right" style={{ color: COLORS.accent }}>You</span>
        <span className="font-semibold text-right" style={{ color: COLORS.inkSoft }}>{theirName}</span>
        {ROWS.map(([label, key]) => [
          <span key={`${key}l`} style={{ color: COLORS.inkSoft }}>{label}</span>,
          <span key={`${key}y`} className="text-right font-semibold" style={{ color: COLORS.ink, fontVariantNumeric: 'tabular-nums' }}>{cell('you', key)}</span>,
          <span key={`${key}t`} className="text-right" style={{ color: COLORS.ink, fontVariantNumeric: 'tabular-nums' }}>{cell('them', key)}</span>,
        ])}
      </div>
      <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>{who(numbers.started)} started; {numbers.ended === 'you' ? 'you' : theirName} sent the last message. Counted on this laptop, and given to Claude as facts.</p>
    </div>
  );
}

export function TipCheck({ lastTip, tipFollowed }) {
  if (!lastTip || !tipFollowed) return null;
  return (
    <div className="rounded-2xl p-3.5 mb-3" style={card} aria-label="Last time's tip">
      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Last time's tip{lastTip.at ? <span className="font-normal" style={{ color: COLORS.inkSoft }}> · {formatCalendarDate(parseISODay(lastTip.at))}</span> : null}</p>
      <p className="text-xs mt-1 italic" style={{ color: COLORS.inkSoft }}>“{lastTip.text}”</p>
      <p className="text-xs mt-1.5" style={{ color: COLORS.ink }}>{tipFollowed}</p>
    </div>
  );
}
