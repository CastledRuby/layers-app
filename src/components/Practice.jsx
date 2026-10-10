// Coach → Practise (decided 2026-10-10): a text chat with Claude playing
// someone, then feedback the way Analyse gives it (lib/practice.js). Pick a
// situation, and a made-up person or one of yours (Claude plays them from what
// Layers knows, names hidden), then chat: Enter sends, Shift+Enter is a new
// line, Ctrl+Enter ends it for feedback. The scores are kept on this laptop
// for Me's "Your chats over time"; a practice is never logged.

import { useEffect, useRef, useState } from 'react';
import { Avatar, ChatBubble, ConvStateBadge, Kbd, LabeledBar } from './atoms.jsx';
import { DIM_COLORS, getLayer } from '../data/constants.js';
import { analysisModel, analysisRequest, analysisResult, recordSpend } from '../lib/analysis.js';
import { addPractice, practicePartner, practiceText, situation, SITUATIONS, theirSamples, turnRequest, turnResult } from '../lib/practice.js';
import { toISODate } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const card = { background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` };

// ready: 'none' | 'no-key' | 'ready', as Analyse. onAnalyse sends a request
// through the main process. startPersonId: practise with them (Prepare's
// "Practise with them").
export function Practice({ people, journal, yourName = '', ready = 'none', onAnalyse, model, onOpenMe, startPersonId = null }) {
  const [step, setStep] = useState('setup'); // 'setup' | 'chat' | 'feedback'
  const [situationKey, setSituationKey] = useState('chat');
  const [personId, setPersonId] = useState(startPersonId && people.some(p => p.id === startPersonId) ? startPersonId : null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const run = useRef(0); // a newer practice drops an older one's answers
  const box = useRef(null);
  const person = people.find(p => p.id === personId) || null;
  const s = situation(situationKey);
  const them = practicePartner(situationKey, person);
  const yours = messages.filter(m => m.who === 'you').length;

  async function send(request) {
    const answer = await Promise.resolve(onAnalyse(request)).catch(() => null);
    if (answer && answer.usage) recordSpend(answer.usage, answer.model || model);
    return answer;
  }
  async function theirTurn(so, ticket) {
    setAsking(true); setError(null);
    const details = person ? ['important', 'plans', 'interests', 'preferences', 'experiences'].flatMap(k => (person[k] || []).filter(it => !it.archived).map(it => it.text)) : [];
    const answer = await send(turnRequest({ situationKey, person, everyone: people, yourName, details, samples: person ? theirSamples(journal, person, yourName) : [], messages: so, model }));
    if (ticket !== run.current) return;
    setAsking(false);
    const reply = answer && answer.result ? turnResult(answer.result, person) : '';
    if (!reply) { setError((answer && answer.error) || "Couldn't get their reply. Try sending again."); return; }
    setMessages([...so, { who: 'them', text: reply }]);
  }
  function start() {
    if (ready !== 'ready') return;
    const ticket = ++run.current;
    setMessages([]); setFeedback(null); setDraft(''); setStep('chat');
    if (s.starts === 'them') theirTurn([], ticket);
  }
  function sendMine() {
    const text = draft.trim();
    if (!text || asking) return;
    const so = [...messages, { who: 'you', text }];
    setMessages(so); setDraft('');
    theirTurn(so, run.current);
  }
  async function end() {
    if (yours < 2 || asking) return;
    const ticket = ++run.current;
    setAsking(true); setError(null);
    const partner = practicePartner(situationKey, person);
    const answer = await send(analysisRequest({ people: [partner], yourName, text: practiceText(messages, { situationKey, person, yourName, everyone: people }), model }));
    if (ticket !== run.current) return;
    setAsking(false);
    if (!answer || answer.error || !answer.result) { setError((answer && answer.error) || "Couldn't get feedback."); return; }
    const result = analysisResult(answer.result, [partner]);
    addPractice({ at: toISODate(new Date()), situation: situationKey, personId: person ? person.id : null, grading: result.grading });
    setFeedback(result); setStep('feedback');
  }
  // The box is ready to type in when it's your turn.
  useEffect(() => { if (step === 'chat' && !asking && box.current) box.current.focus(); }, [step, asking]);

  if (ready !== 'ready') {
    return (
      <div className="rounded-2xl p-3.5" style={{ ...card, border: `1px dashed ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Practise a conversation</p>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{ready === 'none' ? 'Practice is with Claude, in the Windows app.' : 'Claude plays someone while you text, then gives feedback. It needs your Anthropic API key first, in Me.'}</p>
        {ready === 'no-key' && onOpenMe && <button type="button" onClick={onOpenMe} className="text-xs font-semibold rounded-full px-3 py-1.5 mt-2.5" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Add a key in Me</button>}
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div aria-label="Practise">
        <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What do you want to practise?</p>
        <div className="flex flex-col gap-1.5" role="group" aria-label="Situation">
          {SITUATIONS.map(x => (
            <button key={x.key} type="button" onClick={() => setSituationKey(x.key)} aria-pressed={situationKey === x.key} className="text-left rounded-xl px-3 py-2" style={{ ...card, border: `1px solid ${situationKey === x.key ? COLORS.accent : COLORS.line}` }}>
              <span className="text-sm font-semibold block" style={{ color: COLORS.ink }}>{x.title}</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>{x.desc}</span>
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold mt-4 mb-2" style={{ color: COLORS.ink }}>With</p>
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Who Claude plays">
          <button type="button" onClick={() => setPersonId(null)} aria-pressed={!person} className={`chip${!person ? ' chip--on' : ''}`} style={{ padding: '4px 10px' }}>{s.name} (made up)</button>
          {people.map(p => (
            <button key={p.id} type="button" onClick={() => setPersonId(p.id)} aria-pressed={personId === p.id} className={`chip${personId === p.id ? ' chip--on' : ''}`} style={{ padding: '3px 10px 3px 4px' }}><Avatar person={p} size={20} ringColor={getLayer(p.layer).color} />{p.name}</button>
          ))}
        </div>
        <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>
          {person
            ? `Claude plays ${person.name} from what Layers knows: their saved details and a few of their own messages from chats you've logged, with every name swapped for a tag.`
            : `Claude plays ${s.name}, made up. Nothing about your people is sent.`}
          {' '}Each message and the feedback go to Anthropic for {analysisModel(model).name}: a few cents a practice.
        </p>
        <button type="button" onClick={start} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5 mt-3" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Start</button>
      </div>
    );
  }

  if (step === 'feedback' && feedback) {
    const g = feedback.grading;
    return (
      <div aria-label="Practice feedback">
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>{s.title} with {them.name}{person ? '' : ' (made up)'}</p>
        <div className="mt-2 mb-3"><ConvStateBadge stateKey={feedback.conversationState} /></div>
        <div className="rounded-2xl p-4 mb-3" style={card}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Overall</span>
            <span className="font-display" style={{ fontSize: 22, color: COLORS.accent }}>{g.overall}%</span>
          </div>
          <div className="space-y-2.5">
            <LabeledBar label="Depth" percent={g.depth} color={DIM_COLORS.depth} />
            <LabeledBar label="Active listening" percent={g.activeListening} color={DIM_COLORS.listening} />
            <LabeledBar label="Reciprocity" percent={g.reciprocity} color={DIM_COLORS.reciprocity} />
            <LabeledBar label="Naturalness" percent={g.naturalness} color={COLORS.teal} />
          </div>
        </div>
        <div className="rounded-2xl p-4 mb-3" style={card}>
          <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>What went well</p>
          {feedback.wentWell.map((w, i) => <p key={i} className="text-xs mb-0.5" style={{ color: COLORS.good }}>✓ {w}</p>)}
          {feedback.opportunity && <><p className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.ink }}>Opportunity</p><p className="text-xs" style={{ color: COLORS.inkSoft }}>{feedback.opportunity}</p></>}
          {feedback.tryNextTime && <><p className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.ink }}>Try next time</p><p className="text-xs" style={{ color: COLORS.inkSoft }}>{feedback.tryNextTime}</p></>}
        </div>
        <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Kept for Me's "Your chats over time" as practice. Not logged as a real conversation.</p>
        <div className="flex gap-2">
          <button type="button" onClick={start} className="flex-1 text-sm font-semibold rounded-full py-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Practise again</button>
          <button type="button" onClick={() => { run.current += 1; setStep('setup'); }} className="flex-1 text-sm font-semibold rounded-full py-2.5" style={{ color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Something else</button>
        </div>
      </div>
    );
  }

  return (
    <div aria-label="Practice chat">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm" style={{ color: COLORS.inkSoft }}><span className="font-semibold" style={{ color: COLORS.ink }}>{s.title}</span> with {them.name}{person ? '' : ' (made up)'}</p>
        <button type="button" onClick={() => { run.current += 1; setAsking(false); setStep('setup'); }} className="text-xs font-semibold shrink-0" style={{ color: COLORS.inkSoft }}>Stop</button>
      </div>
      <p className="text-xs rounded-xl px-3 py-2 mb-3" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Your aim: {s.aim}.{s.starts === 'you' ? ' You start.' : ''}</p>
      <div className="rounded-2xl p-3.5 mb-3" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, minHeight: 120 }}>
        {messages.map((m, i) => <ChatBubble key={i} who={m.who} text={m.text} name={m.who === 'them' ? them.name : undefined} />)}
        {asking && <p className="text-xs italic" style={{ color: COLORS.inkSoft }} role="status">{them.name} is typing…</p>}
      </div>
      {error && <p className="text-xs mb-2 font-semibold" role="alert" style={{ color: COLORS.alert }}>{error}</p>}
      <textarea ref={box} value={draft} onChange={e => setDraft(e.target.value)} aria-label="Your message" rows={2} placeholder={`Message ${them.name}`}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); end(); }
          else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMine(); }
        }}
        className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={sendMine} disabled={!draft.trim() || asking} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent, opacity: !draft.trim() || asking ? 0.5 : 1 }}>Send <Kbd onAccent>↵</Kbd></button>
        <button type="button" onClick={end} disabled={yours < 2 || asking} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5" style={{ color: COLORS.accent, border: `1px solid ${COLORS.accent}`, opacity: yours < 2 || asking ? 0.5 : 1 }}>End, and feedback <Kbd>Ctrl+↵</Kbd></button>
      </div>
      {yours < 2 && <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Send at least two messages for feedback.</p>}
    </div>
  );
}
