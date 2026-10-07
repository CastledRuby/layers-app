// An analysed chat's review, read again from the Journal: what Claude said
// when it was logged (scores, state, what went well, what to try, what to
// say next) and the chat itself. Kept on the entry (lib/analysis.js,
// analysisToKeep); older analysed logs have only the scores and state.

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { ConvStateBadge, LabeledBar } from '../components/atoms.jsx';
import { DIM_COLORS } from '../data/constants.js';
import { analysisModel } from '../lib/analysis.js';
import { formatCalendarDate, parseISODay } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const SLOTS = [['continueTopic', 'Continue the current topic'], ['shareYourself', 'Share something yourself'], ['changeTopic', 'Change topic naturally'], ['dontMessage', "Don't message yet"]];

function Section({ title, children }) {
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>{title}</p>
      {children}
    </div>
  );
}

export function ChatReviewSheet({ entry, person, onClose }) {
  const [showChat, setShowChat] = useState(false);
  const a = entry.analysis;
  const g = a.grading;
  const r = a.review;
  const day = entry.at ? formatCalendarDate(parseISODay(entry.at)) : '';
  return (
    <Sheet title={`Chat review: ${person ? person.name : 'them'}`} onClose={onClose} tall>
      <p className="text-xs" style={{ color: COLORS.inkSoft }}>{day}{a.model ? ` · read by ${analysisModel(a.model).name}` : ''}. A coach's suggestions, not facts.</p>
      <div className="mt-3"><ConvStateBadge stateKey={a.conversationState} /></div>
      <div className="rounded-2xl p-4 mt-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Overall</span>
          <span className="font-display" style={{ fontSize: 22, color: COLORS.accent }}>{g.overall}%</span>
        </div>
        <div className="space-y-2.5">
          {typeof g.depth === 'number' && <LabeledBar label="Depth" percent={g.depth} color={DIM_COLORS.depth} />}
          {typeof g.activeListening === 'number' && <LabeledBar label="Active listening" percent={g.activeListening} color={DIM_COLORS.listening} />}
          {typeof g.reciprocity === 'number' && <LabeledBar label="Reciprocity" percent={g.reciprocity} color={DIM_COLORS.reciprocity} />}
          {typeof g.naturalness === 'number' && <LabeledBar label="Naturalness" percent={g.naturalness} color={COLORS.teal} />}
        </div>
      </div>
      {r && (
        <>
          {r.recommendation && <p className="text-xs rounded-xl p-3 mt-3" style={{ background: COLORS.layer4Tint, color: COLORS.ink }}>{r.recommendation}</p>}
          {r.wentWell.length > 0 && <Section title="What went well">{r.wentWell.map((w, i) => <p key={i} className="text-xs mb-0.5" style={{ color: COLORS.good }}>✓ {w}</p>)}</Section>}
          {r.opportunity && <Section title="Opportunity"><p className="text-xs" style={{ color: COLORS.inkSoft }}>{r.opportunity}</p></Section>}
          {r.tryNextTime && <Section title="Try next time"><p className="text-xs" style={{ color: COLORS.inkSoft }}>{r.tryNextTime}</p></Section>}
          {r.encourager && (
            <Section title="Encourager use">
              <p className="text-xs font-medium" style={{ color: r.encourager.type === 'good' ? COLORS.good : COLORS.alert }}>{r.encourager.type === 'good' ? 'Good use' : 'Could improve'}: {r.encourager.line}</p>
              {r.encourager.why && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{r.encourager.why}</p>}
            </Section>
          )}
          {r.emotionalCues.length > 0 && <Section title="Possible emotional cues">{r.emotionalCues.map((c, i) => <p key={i} className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{c.emoji} {c.text}</p>)}</Section>}
          {SLOTS.some(([k]) => r.next[k]) && (
            <Section title="What to say next">
              {SLOTS.filter(([k]) => r.next[k]).map(([k, label]) => (
                <div key={k} className="rounded-xl p-3 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>{label}</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{r.next[k].text}</p>
                  {[['natural', 'Natural'], ['playful', 'Playful'], ['deeper', 'Deeper']].filter(([t]) => r.next[k][t]).map(([t, name]) => (
                    <p key={t} className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}><span className="font-semibold">{name}:</span> {r.next[k][t]}</p>
                  ))}
                </div>
              ))}
            </Section>
          )}
        </>
      )}
      {a.chat && (
        <Section title="The chat">
          <button type="button" onClick={() => setShowChat(v => !v)} aria-expanded={showChat} className="text-xs font-semibold" style={{ color: COLORS.accent }}>{showChat ? 'Hide the chat' : 'Show the chat'}</button>
          {showChat && <p aria-label="The chat" className="text-xs mt-2 rounded-xl p-3" style={{ whiteSpace: 'pre-wrap', background: COLORS.paper, border: `1px solid ${COLORS.line}`, color: COLORS.ink, maxHeight: 320, overflowY: 'auto' }}>{a.chat}</p>}
        </Section>
      )}
    </Sheet>
  );
}
