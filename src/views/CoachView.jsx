// Conversation Coach tab: Prepare, Analyse, What to say (ReplyIdeas) and
// Practise (Practice). Keys (no sheet open, not typing): 1 Prepare, 2 Analyse,
// 3 What to say, 4 Practise; on Prepare, ← → who you're about to talk to, L
// logs the conversation with them, A analyses a chat with them, R practises
// with them, O opens their profile. On an analysed chat, S
// saves every detail found and L logs it; Ctrl+Enter in the chat box analyses.
// On Analyse, A analyses all new chats from your exports and R reviews the
// answers waiting (ChatQueueSheet has its own keys).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Plus, X } from 'lucide-react';
import { Avatar, ChatBubble, ConvStateBadge, Kbd, LabeledBar, LayerBadge } from '../components/atoms.jsx';
import { hasOpenSheet, isTyping } from '../components/sheetLayer.js';
import { ANALYSIS_MODELS, analysisCost, analysisModel, analysisRequest, analysisResult, analysisToKeep, DEFAULT_ANALYSIS_MODEL, detectPeople, MAX_SCREENSHOTS, otherSpeakers, recordSpend, typicalCost } from '../lib/analysis.js';
import { DateDropdown } from '../components/pickers.jsx';
import { ChatExports } from '../components/ChatExports.jsx';
import { ChatBatchCard } from '../components/ChatBatch.jsx';
import { ReplyIdeas } from '../components/ReplyIdeas.jsx';
import { Practice } from '../components/Practice.jsx';
import { ChatQueueSheet } from '../modals/ChatQueueSheet.jsx';
import { batchPlan } from '../lib/chatBatch.js';
import { chatPeople, conversationLabel, conversationText, isoDayOf, loadChatExports, readChatProgress, saveChatProgress, sourceLabel } from '../lib/chatImport.js';
import { formatCalendarDate, parseISODay } from '../lib/dates.js';
import { isPictureFile } from '../data/avatars.js';
import { loadPhoto, shrinkForAnalysis } from '../lib/photo.js';
import { AL_ITEMS, categoryMeta, DIM_COLORS, DIM_LABELS, DIM_ORDER, getLayer, ML_LABELS } from '../data/constants.js';
import { SCENARIOS } from '../data/scenarios.js';
import { buildPotentialHooks, HOOKS } from '../lib/text.js';
import { COLORS } from '../theme.js';

// A suggestion's three versions, where it has them: how you might actually word it.
function Tones({ item, intro }) {
  if (!item || !(item.natural || item.playful || item.deeper)) return null;
  return (
    <div className="mt-2 space-y-1">
      {intro && <p className="text-xs italic" style={{ color: COLORS.inkSoft }}>{intro}</p>}
      {[['natural', 'Natural'], ['playful', 'Playful'], ['deeper', 'Deeper']].filter(([k]) => item[k]).map(([k, label]) => (
        <p key={k} className="text-xs" style={{ color: COLORS.inkSoft }}><span className="font-semibold">{label}:</span> {item[k]}</p>
      ))}
    </div>
  );
}

// Which Claude reads your chat: one button per model, cheapest first. done:
// the models that already answered this chat (shown again for free).
function ModelButtons({ label, value, onPick, done = {} }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {ANALYSIS_MODELS.map(m => (
        <button key={m.id} type="button" onClick={() => onPick(m.id)} aria-pressed={value === m.id} className={`chip${value === m.id ? ' chip--on' : ''}`} style={{ padding: '5px 10px' }}>
          {done[m.id] && <Check size={12} />}{m.short}{m.id === DEFAULT_ANALYSIS_MODEL && <span style={{ opacity: 0.7, fontWeight: 500 }}>· cheapest</span>}
        </button>
      ))}
    </div>
  );
}

// analysisReady: 'none' (no desktop bridge), 'no-key' or 'ready', for
// analysing your own chat with Claude (onAnalyse sends the request built by
// lib/analysis.js and resolves to { result, usage, model } or { error }).
// model / onModel: which Claude (App keeps it while Layers is open).
// onLogChat: saves your own chat's log ({ personIds, meaningfulness, ratings,
// activeListening, summary, date, analysis }) as a normal log. chatExports:
// the main process's Layers chats folder (listChatExports, readChatExport,
// openChatsFolder, onChatExportsChanged), or null. onApproveInfo saves a
// detail found (with its day, `when`, and `remind` for a follow-up the day
// after), onApproveInfoAll several at once, onRemindAbout sets that follow-up
// for one already saved. chatBatch: Analyse all new from LayersApp (running,
// note, waiting, progress, saveProgress, start, stop, onLog, onSkip,
// onRemind), or null.
export function CoachView({ people, journal, initialPersonId, initialTab, onOpenLog, onApproveInfo, onApproveInfoAll, onRemindAbout, onLogFromAnalysis, onLogChat, onOpenPerson, analysisReady = 'none', onAnalyse, onOpenMe, yourName = '', model = DEFAULT_ANALYSIS_MODEL, onModel = () => {}, chatExports = null, initialChatKey = null, chatBatch = null, style = '' }) {
  const [tab, setTab] = useState(initialTab || 'prepare');
  const [preparePersonId, setPreparePersonId] = useState(initialPersonId || (people[0] && people[0].id) || null);
  const [analysisPersonId, setAnalysisPersonId] = useState(initialTab === 'analyse' ? initialPersonId || null : null);
  const [step, setStep] = useState('pick');
  const [scenarioKey, setScenarioKey] = useState(null);
  const [infoDrafts, setInfoDrafts] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  // What's been saved, ignored and logged for each person + sample, so going
  // back and picking the same sample again can't save it twice.
  const [sessions, setSessions] = useState({});
  // Your own chat: pasted text and screenshots, then Claude's answer.
  const [ownText, setOwnText] = useState('');
  const [ownShots, setOwnShots] = useState([]); // [{ id, name, src, img }]
  // The chat sent ({ run, person, text, images }), kept so it can be tried
  // with another model, and each model's answer: { [model]: { result, cost } }.
  const [ownChat, setOwnChat] = useState(null);
  const [ownResults, setOwnResults] = useState({});
  const [ownModel, setOwnModel] = useState(null); // whose answer is shown
  const [askingModel, setAskingModel] = useState(model);
  const [ownError, setOwnError] = useState(null);
  // Who your chat is with: null is the person picked above; otherwise ids,
  // read from the names on its messages ('chat') or chosen here ('you').
  const [ownWith, setOwnWith] = useState(null);
  const [ownWithFrom, setOwnWithFrom] = useState(null);
  const [ownWithPicking, setOwnWithPicking] = useState(false);
  const [ownLogDate, setOwnLogDate] = useState(() => new Date());
  // Chats from your exports: what's in the Layers chats folder (null while
  // it's read), where you got up to in each, and the conversation in the box
  // ({ key, end, day, label }), which dates the log and moves you on.
  const [exportsState, setExportsState] = useState(null);
  // Where you got up to in each chat: LayersApp's, since Analyse all new moves it on too.
  const [ownProgress, setOwnProgress] = useState(() => readChatProgress());
  const chatProgress = chatBatch ? chatBatch.progress : ownProgress;
  const saveProgress = (key, change) => (chatBatch ? chatBatch.saveProgress(key, change) : setOwnProgress(saveChatProgress(key, change)));
  const [reviewing, setReviewing] = useState(false);
  const [planNow] = useState(() => Date.now()); // "new" is reckoned from when Coach opened, as in ChatExports
  const [ownSource, setOwnSource] = useState(null);
  const [chatsFolder, setChatsFolder] = useState(null);
  const shotsInput = useRef(null);
  // Screenshots are for the phone; on the laptop a chat is pasted.
  const touch = useMemo(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches, []);
  // Counts requests, so an answer that arrives after you've moved on (another
  // person, back to the list, or a newer request) is dropped; and chats, so
  // each is its own session.
  const ownTicket = useRef(0);
  const ownChats = useRef(0);

  // The folder is read when Analyse opens, and again when a file arrives.
  const exportsOn = (tab === 'analyse' || tab === 'reply') && analysisReady === 'ready' && !!chatExports;
  // Reply ideas on a chat in Analyse: What to say, with its latest conversation in.
  const [replyStart, setReplyStart] = useState(null); // { n, chat, conv, owner }
  // Practise with them, from Prepare: the Practise tab with them picked.
  const [practiseStart, setPractiseStart] = useState({ n: 0, personId: null });
  function practiseWith(personId) { setPractiseStart(s => ({ n: s.n + 1, personId })); setTab('practise'); }
  function replyFromChat(chat, conv, owner) { setReplyStart(s => ({ n: (s ? s.n : 0) + 1, chat, conv, owner })); setTab('reply'); }
  // Analyse all new: what there is to send, from the chats read.
  const batchOn = !!chatBatch;
  const plan = useMemo(() => (exportsOn && batchOn && exportsState ? batchPlan(exportsState.chats, { people, yourName, progress: chatProgress, now: planNow }) : null), [exportsOn, batchOn, exportsState, people, yourName, chatProgress, planNow]);
  const startBatch = () => { if (plan && plan.items.length && !chatBatch.running) chatBatch.start(plan.items, model); };
  useEffect(() => {
    if (!exportsOn) return undefined;
    let live = true;
    const load = () => { loadChatExports(chatExports).then(r => { if (live) setExportsState(r); }).catch(() => { if (live) setExportsState({ chats: [], problems: [] }); }); };
    load();
    if (chatExports.getChatsInfo) Promise.resolve(chatExports.getChatsInfo()).then(info => { if (live && info && info.dir) setChatsFolder(info.dir.split(/[\\/]/).slice(-2).join(' → ')); }).catch(() => {});
    const stop = chatExports.onChatExportsChanged ? chatExports.onChatExportsChanged(load) : null;
    return () => { live = false; if (stop) stop(); };
  }, [exportsOn, chatExports]);

  useEffect(() => {
    if (step === 'loading') {
      const t = setTimeout(() => setStep('results'), 900);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Coach can be opened for someone who has since been removed (or whose id
  // came from a restored or imported backup). Prepare then falls back to the
  // first person, and Analyse asks who the conversation was with: it used to
  // read the missing person's emoji and blank the whole window.
  const preparePerson = people.find(p => p.id === preparePersonId) || people[0] || null;
  const scenario = scenarioKey ? (scenarioKey.startsWith('own') ? (ownResults[ownModel] || {}).result || null : SCENARIOS[scenarioKey]) : null;
  const scenarioPerson = people.find(p => p.id === analysisPersonId) || null;
  const ownPeople = (ownWith || (scenarioPerson ? [scenarioPerson.id] : [])).map(id => people.find(p => p.id === id)).filter(Boolean);
  const nameOf = (id) => (people.find(p => p.id === id) || scenarioPerson || { name: 'them' }).name;
  const sessionKey = scenarioPerson && scenarioKey ? `${scenarioPerson.id}:${scenarioKey}` : null;
  const session = (sessionKey && sessions[sessionKey]) || { infoStatus: {}, logged: false };
  const infoStatus = session.infoStatus;
  // One chat is logged once, whichever model's answer it's logged from.
  const logged = session.logged || Boolean(scenario && scenario.own && ownChat && scenarioPerson && Object.entries(sessions).some(([k, s]) => s.logged && k.startsWith(`${scenarioPerson.id}:own:${ownChat.run}:`)));
  function updateSession(change) {
    setSessions(all => {
      const current = all[sessionKey] || { infoStatus: {}, logged: false };
      return { ...all, [sessionKey]: { ...current, ...change(current) } };
    });
  }

  function pickScenario(key) {
    const sc = SCENARIOS[key];
    setScenarioKey(key);
    setInfoDrafts(Object.fromEntries(sc.extractedInfo.map((it, i) => [i, it.text])));
    setEditingIndex(null);
    setStep('loading');
  }
  function resetAnalyse() { ownTicket.current += 1; setStep('pick'); setScenarioKey(null); setOwnWith(null); setOwnWithFrom(null); setOwnWithPicking(false); }
  // Pasting reads who it's with from the names on the messages (unless you
  // chose who yourself), and Analyse follows them.
  function changeOwnText(value) {
    setOwnText(value);
    setOwnError(null);
    if (!value.trim()) setOwnSource(null);
    if (ownWithFrom === 'you') return;
    const found = detectPeople(value, people, yourName);
    if (found.length) { setOwnWith(found); setOwnWithFrom('chat'); setAnalysisPersonId(found[0]); }
    else if (ownWithFrom === 'chat') { setOwnWith(null); setOwnWithFrom(null); }
  }
  // A conversation from your chats, into the box: who it's with from the
  // names on it, written with exact times, and its day for the log.
  function pickConversation(chat, conv, owner) {
    const { ids, nameFor } = chatPeople(chat, people, owner);
    setOwnText(conversationText(conv, { owner, yourName, nameFor }));
    setOwnError(null);
    setOwnShots([]);
    if (ids.length) { setOwnWith(ids); setOwnWithFrom('chat'); setAnalysisPersonId(ids[0]); }
    else { setOwnWith(null); setOwnWithFrom(null); }
    setOwnSource({ key: chat.key, end: conv.end, day: isoDayOf(conv.end), label: `${sourceLabel(chat.source)} · ${chat.title} · ${conversationLabel(conv)}` });
  }
  function changeWith(ids) { setOwnWith(ids); setOwnWithFrom('you'); if (ids.length) setAnalysisPersonId(ids[0]); }
  async function addShots(files) {
    const pictures = [...files].filter(isPictureFile).slice(0, MAX_SCREENSHOTS - ownShots.length);
    const loaded = (await Promise.all(pictures.map(async file => { const img = await loadPhoto(file); return img ? { id: `${file.name}${file.size}${Math.random()}`, name: file.name, src: img.src, img } : null; }))).filter(Boolean);
    setOwnShots(list => [...list, ...loaded].slice(0, MAX_SCREENSHOTS));
    setOwnError(loaded.length < pictures.length ? "Some of those aren't pictures Layers can read." : null);
  }
  // Sends your chat to Claude (only now), then shows its answer like a sample's.
  async function analyseOwn() {
    if (!onAnalyse || !ownPeople.length || (!ownText.trim() && !ownShots.length)) return;
    const chat = { run: ++ownChats.current, people: ownPeople, text: ownText, images: ownShots.map(s => shrinkForAnalysis(s.img)).filter(Boolean), source: ownSource };
    if (await ask(chat, {}, model, 'pick')) {
      setOwnText(''); setOwnShots([]); setOwnWith(null); setOwnWithFrom(null); setOwnWithPicking(false); setOwnSource(null);
      // That chat's analysed up to here: its next export shows only what's after.
      if (chat.source) saveProgress(chat.source.key, { at: Math.max((readChatProgress()[chat.source.key] || {}).at || 0, chat.source.end) });
    }
  }
  // One model's answer to a chat; on a problem, back to `backTo` saying so.
  async function ask(chat, results, withModel, backTo) {
    const ticket = ++ownTicket.current;
    setOwnError(null);
    setAskingModel(withModel);
    setStep('asking');
    const answer = await Promise.resolve(onAnalyse(analysisRequest({ people: chat.people, yourName, text: chat.text, images: chat.images, model: withModel }))).catch(() => null);
    if (answer && answer.usage) recordSpend(answer.usage, answer.model || withModel); // charged, whatever happens next
    if (ticket !== ownTicket.current) return false;
    if (!answer || answer.error) { setOwnError((answer && answer.error) || "Couldn't analyse that chat."); setStep(backTo); return false; }
    const used = analysisModel(answer.model || withModel).id;
    const result = analysisResult(answer.result, chat.people, { others: otherSpeakers(chat.text, chat.people, yourName) });
    if (chat.source) result.log.date = chat.source.day; // the export's own times
    setOwnChat(chat);
    setOwnResults({ ...results, [used]: { result, cost: analysisCost(answer.usage, used) } });
    showOwn(chat, used, result);
    return true;
  }
  function showOwn(chat, withModel, result) {
    setOwnModel(withModel);
    setOwnLogDate(result.log.date ? parseISODay(result.log.date) : new Date());
    setInfoDrafts(Object.fromEntries(result.extractedInfo.map((it, i) => [i, it.text])));
    setEditingIndex(null);
    setScenarioKey(`own:${chat.run}:${withModel}`);
    setStep('results');
  }
  // The same chat with another model: asked once, then shown again for free.
  function tryModel(withModel) {
    onModel(withModel);
    if (!ownChat || withModel === ownModel) return;
    if (ownResults[withModel]) { setOwnError(null); showOwn(ownChat, withModel, ownResults[withModel].result); }
    else ask(ownChat, ownResults, withModel, 'results');
  }
  function changeAnalysisPerson() { setAnalysisPersonId(null); resetAnalyse(); }
  // Each detail is saved (with a reminder the day after, for one with a
  // day), ignored, or saved with the rest; `infoStatus`: 'saved', 'reminded'
  // or 'ignored'.
  const infoPersonId = (it) => it.personId || scenarioPerson.id;
  function saveInfoItem(i, { remind = false } = {}) {
    const it = scenario.extractedInfo[i];
    const text = String(infoDrafts[i] || '').trim();
    if (!text) return;
    onApproveInfo(infoPersonId(it), it.category, text, it.temporary, { when: it.when, remind });
    updateSession(s => ({ infoStatus: { ...s.infoStatus, [i]: remind ? 'reminded' : 'saved' } }));
    setEditingIndex(null);
  }
  function remindInfoItem(i) {
    const it = scenario.extractedInfo[i];
    if (!onRemindAbout) return;
    onRemindAbout(infoPersonId(it), { text: String(infoDrafts[i] || it.text).trim(), when: it.when });
    updateSession(s => ({ infoStatus: { ...s.infoStatus, [i]: 'reminded' } }));
  }
  const unsavedInfo = scenario && scenario.extractedInfo ? scenario.extractedInfo.map((_, i) => i).filter(i => !infoStatus[i] && String(infoDrafts[i] || '').trim()) : [];
  function saveAllInfo() {
    if (!unsavedInfo.length || !onApproveInfoAll) return;
    onApproveInfoAll(unsavedInfo.map(i => { const it = scenario.extractedInfo[i]; return { personId: infoPersonId(it), category: it.category, text: infoDrafts[i], temporary: it.temporary, when: it.when }; }));
    updateSession(s => ({ infoStatus: { ...s.infoStatus, ...Object.fromEntries(unsavedInfo.map(i => [i, 'saved'])) } }));
    setEditingIndex(null);
  }
  function ignoreInfoItem(i) { updateSession(s => ({ infoStatus: { ...s.infoStatus, [i]: 'ignored' } })); setEditingIndex(null); }
  // Your own chat: a normal log, filled in by Claude, on the chat's day, with
  // Claude's review and the chat kept on it (the Journal's Review).
  function logOwn() {
    if (logged || !onLogChat) return;
    onLogChat({ ...scenario.log, date: ownLogDate, analysis: analysisToKeep(scenario, { model: ownModel, chat: ownChat && ownChat.text }) });
    updateSession(() => ({ logged: true }));
  }
  function handleLogAnalysis() {
    if (logged) return;
    onLogFromAnalysis(scenarioPerson.id, scenario);
    updateSession(() => ({ logged: true }));
  }

  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || hasOpenSheet() || isTyping()) return;
      const el = document.activeElement;
      if (el && el.tagName === 'BUTTON' && e.key === 'Enter') return;
      const key = e.key.toLowerCase();
      const act = (fn) => { e.preventDefault(); fn(); };
      if (e.key === '1') { act(() => setTab('prepare')); return; }
      if (e.key === '2') { act(() => setTab('analyse')); return; }
      if (e.key === '3') { act(() => setTab('reply')); return; }
      if (e.key === '4') { act(() => setTab('practise')); return; }
      if (tab === 'analyse' && chatBatch && exportsOn && (!scenarioPerson || step === 'pick')) {
        if (key === 'a' && plan && plan.items.length && !chatBatch.running) { act(startBatch); return; }
        if (key === 'r' && chatBatch.waiting.length) { act(() => setReviewing(true)); return; }
      }
      if (tab === 'analyse' && step === 'results' && scenario && scenarioPerson) {
        if (key === 's' && unsavedInfo.length && onApproveInfoAll) act(saveAllInfo);
        else if (key === 'l' && !logged) act(() => (scenario.own ? logOwn() : handleLogAnalysis()));
        return;
      }
      if (tab !== 'prepare' || !preparePerson) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && people.length > 1) {
        act(() => {
          const i = people.findIndex(p => p.id === preparePerson.id);
          setPreparePersonId(people[(i + (e.key === 'ArrowLeft' ? people.length - 1 : 1)) % people.length].id);
        });
      } else if (key === 'l') act(() => onOpenLog(preparePerson.id));
      else if (key === 'a') act(() => { if (preparePerson.id !== analysisPersonId) resetAnalyse(); setAnalysisPersonId(preparePerson.id); setTab('analyse'); });
      else if (key === 'o') act(() => onOpenPerson(preparePerson.id));
      else if (key === 'r') act(() => practiseWith(preparePerson.id));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="px-5 pt-6 pb-4">
      {reviewing && chatBatch && chatBatch.waiting.length > 0 && <ChatQueueSheet items={chatBatch.waiting} people={people} onLog={chatBatch.onLog} onSkip={chatBatch.onSkip} onRemind={chatBatch.onRemind} onClose={() => setReviewing(false)} />}
      <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Conversation Coach</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>Noticing, responding and adapting, not scripts.</p>

      <div className="flex items-center gap-2 mt-4">
        {[{ k: 'prepare', label: 'Prepare' }, { k: 'analyse', label: 'Analyse a chat' }, { k: 'reply', label: 'What to say' }, { k: 'practise', label: 'Practise' }].map((t, i) => (
          <button key={t.k} onClick={() => setTab(t.k)} aria-pressed={tab === t.k} className="flex items-center gap-1.5 text-xs font-semibold rounded-full pl-3 pr-1.5 py-1" style={{ background: tab === t.k ? COLORS.accent : COLORS.paperRaised, color: tab === t.k ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${tab === t.k ? COLORS.accent : COLORS.line}` }}>{t.label}<Kbd onAccent={tab === t.k}>{i + 1}</Kbd></button>
        ))}
      </div>

      {tab === 'prepare' && (
        <div className="mt-5">
          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: COLORS.ink }}>Who are you about to talk to?{people.length > 1 && <><Kbd>←</Kbd><Kbd>→</Kbd></>}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, rowGap: 12, paddingBottom: 4, marginBottom: 16, maxHeight: 168, overflowY: 'auto' }}>
            {people.map(p => {
              const active = !!preparePerson && preparePerson.id === p.id; const l = getLayer(p.layer);
              return (
                <button key={p.id} onClick={() => setPreparePersonId(p.id)} aria-pressed={active} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                  <Avatar person={p} size={44} ringColor={active ? COLORS.accent : l.color} />
                  <span className="text-xs truncate" style={{ maxWidth: 56, color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{p.name}</span>
                </button>
              );
            })}
          </div>

          {preparePerson && (
            <div className="rounded-2xl p-4 mb-5" style={{ background: getLayer(preparePerson.layer).tint }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: getLayer(preparePerson.layer).deep }}>{preparePerson.name}</p>
                <LayerBadge layerId={preparePerson.layer} />
              </div>
              {preparePerson.goals.filter(g => g.progress < 100).slice(0, 2).length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Active goals</p>
                  {preparePerson.goals.filter(g => g.progress < 100).slice(0, 2).map(g => (<p key={g.id} className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{g.title}: {g.progress}%</p>))}
                </div>
              )}
              {preparePerson.interests.filter(i => !i.archived).length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Known interests</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {preparePerson.interests.filter(i => !i.archived).map(i => (<span key={i.id} className="text-xs rounded-full px-2 py-0.5" style={{ background: COLORS.paperRaised }}>{i.emoji} {i.text}</span>))}
                  </div>
                </div>
              )}
              {preparePerson.plans.filter(i => !i.archived).length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Things they've mentioned</p>
                  {preparePerson.plans.filter(i => !i.archived).slice(0, 2).map(i => (<p key={i.id} className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{i.emoji} {i.text}</p>))}
                </div>
              )}
            </div>
          )}

          {preparePerson && (() => {
            const hooks = buildPotentialHooks(preparePerson, journal);
            return hooks.length > 0 ? (
              <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Potential hooks for {preparePerson.name}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Prompts, not scripts — things worth noticing an opening for.</p>
                <div className="grid grid-cols-1 gap-1.5 mt-2.5">
                  {hooks.map(h => (
                    <div key={h.key} className="rounded-xl px-3 py-2" style={{ background: COLORS.accentSoft }}>
                      <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>{h.label}: </span>
                      <span className="text-xs" style={{ color: COLORS.ink }}>{h.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px dashed ${COLORS.line}` }}>
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>No saved information for {preparePerson.name} yet</p>
                <p className="text-xs mt-1 mb-2.5" style={{ color: COLORS.inkSoft }}>Add an interest or two and Prepare can surface hooks here automatically.</p>
                <button onClick={() => onOpenPerson(preparePerson.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full pl-3 pr-1.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Open {preparePerson.name}'s profile <Kbd>O</Kbd></button>
              </div>
            );
          })()}

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Spot the hooks</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>They say: "I started playing tennis recently."</p>
            <div className="grid grid-cols-1 gap-1.5 mt-2.5">
              {HOOKS.map(h => (
                <div key={h.key} className="rounded-xl px-3 py-2" style={{ background: COLORS.accentSoft }}>
                  <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>{h.label}: </span>
                  <span className="text-xs" style={{ color: COLORS.ink }}>{h.question}</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>The best follow-up is usually based on something the person actually seems interested in discussing.</p>
          </div>

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Listen → follow up → share → follow up → listen</p>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Person: "I went skiing last weekend."</p>
            <p className="text-xs mt-1" style={{ color: COLORS.ink }}>You: "I've only been once and I was terrible. Where did you go?"</p>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs" style={{ color: COLORS.good }}>✓ Responded to their topic</p>
              <p className="text-xs" style={{ color: COLORS.good }}>✓ Shared something personal</p>
              <p className="text-xs" style={{ color: COLORS.good }}>✓ Asked a relevant follow-up</p>
            </div>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Conversation shouldn't become an interview. Share as often as you ask.</p>
          </div>

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Spotting hand-offs</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Person: "I've been getting really into F1 lately."</p>
            <p className="text-xs mt-1" style={{ color: COLORS.ink }}>If you like F1 too, this is a natural moment to share your own experience rather than asking another question.</p>
          </div>

          <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Encourager check</p>
            <p className="text-xs mt-2 font-semibold" style={{ color: COLORS.good }}>Good: "Really? What happened?" right after they share a story.</p>
            <p className="text-xs mt-2 font-semibold" style={{ color: COLORS.alert }}>Poor: "Really?" "Really?" "Tell me more." repeated after short answers.</p>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Encouragers help when they respond to something real, not just to fill space.</p>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button onClick={() => onOpenLog(preparePerson ? preparePerson.id : null)} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-3 text-center" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Log this conversation <Kbd onAccent>L</Kbd></button>
            <button onClick={() => { const id = preparePerson ? preparePerson.id : null; if (id !== analysisPersonId) resetAnalyse(); setAnalysisPersonId(id); setTab('analyse'); }} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-3 text-center" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Analyse your chat <Kbd>A</Kbd></button>
          </div>
          {preparePerson && <button type="button" onClick={() => practiseWith(preparePerson.id)} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5 mt-2" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.line}` }}>Practise with {preparePerson.name.split(' ')[0]} first <Kbd>R</Kbd></button>}

          <p className="text-xs text-center mt-5" style={{ color: COLORS.inkSoft }}>Good social skills are about noticing, responding and adapting, not forcing a particular outcome.</p>
        </div>
      )}

      {tab === 'practise' && (
        <div className="mt-5">
          <Practice key={practiseStart.n} people={people} journal={journal} yourName={yourName} ready={analysisReady} onAnalyse={onAnalyse} model={model} onOpenMe={onOpenMe} startPersonId={practiseStart.personId} />
        </div>
      )}

      {tab === 'reply' && (
        <div className="mt-5">
          <ReplyIdeas key={replyStart ? replyStart.n : 0} people={people} journal={journal} yourName={yourName} style={style} ready={analysisReady} onAnalyse={onAnalyse} model={model} onOpenMe={onOpenMe} start={replyStart}
            chatsList={exportsOn ? (pick) => <ChatExports state={exportsState} people={people} yourName={yourName} progress={chatProgress} folder={chatsFolder || undefined} onPick={pick} onPickMe={(key, name) => saveProgress(key, { me: name })} onOpenFolder={chatExports.openChatsFolder ? () => chatExports.openChatsFolder() : null} showAll /> : null} />
        </div>
      )}

      {tab === 'analyse' && (
        <div className="mt-5">
          {people.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Add someone in the People tab first, then come back to analyse a conversation with them.</p>
          ) : !scenarioPerson ? (
            <>
              {exportsOn && chatBatch && <ChatBatchCard plan={plan} batch={chatBatch} model={model} people={people} onStart={startBatch} onReview={() => setReviewing(true)} />}
              {exportsOn && <ChatExports state={exportsState} people={people} yourName={yourName} progress={chatProgress} folder={chatsFolder || undefined} onPick={pickConversation} onPickMe={(key, name) => saveProgress(key, { me: name })} onOpenFolder={chatExports.openChatsFolder ? () => chatExports.openChatsFolder() : null} initialOpen={initialChatKey} onReply={replyFromChat} />}
              {ownSource && <p className="text-xs mb-2 font-semibold" style={{ color: COLORS.accent }}>Nobody in that chat is in Layers yet. Who is it with?</p>}
              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Who is this conversation with?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, rowGap: 12, paddingBottom: 4, maxHeight: 168, overflowY: 'auto' }}>
                {people.map(p => {
                  const l = getLayer(p.layer);
                  return (
                    <button key={p.id} onClick={() => setAnalysisPersonId(p.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                      <Avatar person={p} size={44} ringColor={l.color} />
                      <span className="text-xs truncate" style={{ maxWidth: 56, color: COLORS.inkSoft }}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {step === 'pick' && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar person={scenarioPerson} size={30} ringColor={getLayer(scenarioPerson.layer).color} />
                    <p className="text-sm" style={{ color: COLORS.inkSoft }}>Analysing a conversation with <span className="font-semibold" style={{ color: COLORS.ink }}>{scenarioPerson.name}</span></p>
                  </div>
                  <p className="text-xs rounded-xl p-3 mb-4" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>🔒 Only analyse conversations you're allowed to share.</p>
                  {analysisReady === 'no-key' && (
                    <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paperRaised, border: `1px dashed ${COLORS.line}` }}>
                      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Analyse your own chat</p>
                      <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Paste a chat or add screenshots, and Claude reads it. It needs your Anthropic API key first, in Me.</p>
                      {onOpenMe && <button type="button" onClick={onOpenMe} className="text-xs font-semibold rounded-full px-3 py-1.5 mt-2.5" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Add a key in Me</button>}
                    </div>
                  )}
                  {exportsOn && chatBatch && <ChatBatchCard plan={plan} batch={chatBatch} model={model} people={people} onStart={startBatch} onReview={() => setReviewing(true)} />}
                  {exportsOn && <ChatExports state={exportsState} people={people} yourName={yourName} progress={chatProgress} folder={chatsFolder || undefined} onPick={pickConversation} onPickMe={(key, name) => saveProgress(key, { me: name })} onOpenFolder={chatExports.openChatsFolder ? () => chatExports.openChatsFolder() : null} onReply={replyFromChat} />}
                  {analysisReady === 'ready' && (
                    <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Your own chat">
                      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Analyse your own chat</p>
                      <div role="group" aria-label="Who it's with" className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span className="text-xs font-semibold mr-0.5" style={{ color: COLORS.ink }}>With</span>
                        {ownPeople.map(p => (
                          <span key={p.id} className="chip chip--on" style={{ padding: '3px 8px 3px 4px' }}>
                            <Avatar person={p} size={20} ringColor={getLayer(p.layer).color} />{p.name}
                            {ownPeople.length > 1 && <button type="button" onClick={() => changeWith(ownPeople.filter(x => x.id !== p.id).map(x => x.id))} aria-label={`Not with ${p.name}`} className="flex items-center"><X size={12} /></button>}
                          </span>
                        ))}
                        {people.length > ownPeople.length && <button type="button" onClick={() => setOwnWithPicking(v => !v)} aria-expanded={ownWithPicking} className="chip" style={{ padding: '4px 10px' }}><Plus size={12} color={COLORS.accent} />Someone else</button>}
                        {ownWithFrom === 'chat' && <span className="text-xs" style={{ color: COLORS.inkSoft }}>from the names in the chat</span>}
                      </div>
                      {ownWithPicking && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2" aria-label="Add someone">
                          {people.filter(p => !ownPeople.some(x => x.id === p.id)).map(p => (
                            <button key={p.id} type="button" onClick={() => { changeWith([...ownPeople.map(x => x.id), p.id]); setOwnWithPicking(false); }} className="chip" style={{ padding: '3px 10px 3px 4px' }}><Avatar person={p} size={20} ringColor={getLayer(p.layer).color} />{p.name}</button>
                          ))}
                        </div>
                      )}
                      {ownSource && (
                        <p className="text-xs mt-2 flex items-center gap-2" style={{ color: COLORS.inkSoft }}>
                          <span className="flex-1 min-w-0">From {ownSource.label}</span>
                          <button type="button" onClick={() => { setOwnSource(null); changeOwnText(''); }} className="font-semibold shrink-0" style={{ color: COLORS.accent }}>Clear</button>
                        </p>
                      )}
                      <textarea value={ownText} onChange={e => changeOwnText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); analyseOwn(); } }} aria-label="The chat" rows={ownSource ? 8 : 5}
                        placeholder={`Paste the chat${touch ? ', or add screenshots below' : ''}. Names on the messages ("Amelie: hey") tell Layers who it's with.`} className="w-full text-sm rounded-xl px-3 py-2.5 mt-2" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />
                      {touch && <input ref={shotsInput} type="file" accept="image/*" multiple hidden aria-label="Add screenshots" onChange={e => { const files = e.target.files ? [...e.target.files] : []; e.target.value = ''; addShots(files); }} />}
                      {touch && <div className="flex items-center gap-2 flex-wrap mt-2">
                        {ownShots.map(s => (
                          <span key={s.id} className="relative">
                            <img src={s.src} alt={s.name} className="rounded-lg" style={{ width: 44, height: 64, objectFit: 'cover', border: `1px solid ${COLORS.line}` }} />
                            <button type="button" onClick={() => setOwnShots(list => list.filter(x => x.id !== s.id))} aria-label={`Remove ${s.name}`} className="absolute flex items-center justify-center rounded-full" style={{ top: -6, right: -6, width: 20, height: 20, background: COLORS.ink }}><X size={11} color={COLORS.paper} /></button>
                          </span>
                        ))}
                        {ownShots.length < MAX_SCREENSHOTS && <button type="button" onClick={() => shotsInput.current && shotsInput.current.click()} className="chip"><ImagePlus size={14} color={COLORS.accent} /> Screenshots</button>}
                      </div>}
                      <p className="text-xs font-semibold mt-3 mb-1.5" style={{ color: COLORS.ink }}>Model</p>
                      <ModelButtons label="Model" value={model} onPick={onModel} />
                      <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>Pressing Analyse sends this chat, and only this chat, to Anthropic for {analysisModel(model).name} to read ({typicalCost(model)}{analysisModel(model).thinks ? '; it thinks first, so it takes longer and costs more' : ''}). {ownPeople.map(p => p.name.split(' ')[0]).join(', ')}'s name and yours are swapped for tags first{touch ? '; screenshots go as they are' : ''}.</p>
                      {ownError && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: COLORS.alert }}>{ownError}</p>}
                      <button type="button" onClick={analyseOwn} disabled={!ownPeople.length || (!ownText.trim() && !ownShots.length)} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-2.5 mt-3" style={{ background: COLORS.accent, color: COLORS.onAccent, opacity: !ownPeople.length || (!ownText.trim() && !ownShots.length) ? 0.5 : 1 }}>Analyse with Claude <Kbd onAccent>Ctrl+↵</Kbd></button>
                    </div>
                  )}
                  <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>{analysisReady === 'ready' ? 'Or try a sample conversation' : 'Try a sample conversation'}</p>
                  {Object.values(SCENARIOS).map(sc => (
                    <button key={sc.key} onClick={() => pickScenario(sc.key)} className="w-full flex items-center gap-3 rounded-2xl p-3.5 mb-2 text-left" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                      <span style={{ fontSize: 22 }}>📸</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{sc.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{sc.preview}</p>
                      </div>
                    </button>
                  ))}
                  <button onClick={changeAnalysisPerson} className="text-xs font-medium mt-2" style={{ color: COLORS.inkSoft }}>Change person</button>
                </>
              )}

          {step === 'asking' && (
            <div className="flex flex-col items-center justify-center py-16" role="status">
              <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid ${COLORS.line}`, borderTopColor: COLORS.accent }} className="spin" />
              <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>{analysisModel(askingModel).name} is reading the chat…</p>
              {analysisModel(askingModel).thinks && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>It thinks first, so this can take a minute.</p>}
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid ${COLORS.line}`, borderTopColor: COLORS.accent }} className="spin" />
              <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>Reading the conversation...</p>
            </div>
          )}

          {step === 'results' && scenario && (
            <div>
              <button onClick={resetAnalyse} className="text-xs font-medium mb-3" style={{ color: COLORS.inkSoft }}>{scenario.own ? '← Analyse another chat' : '← Try a different sample'}</button>
              {scenario.own && (
                <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>Read by {analysisModel(ownModel).name}: this one cost {ownResults[ownModel].cost}. These are a coach's suggestions, not facts.</p>
                  <p className="text-xs font-semibold mt-2.5 mb-1.5" style={{ color: COLORS.ink }}>The same chat with another model</p>
                  <ModelButtons label="The same chat with" value={ownModel} onPick={tryModel} done={ownResults} />
                  {ownError && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: COLORS.alert }}>{ownError}</p>}
                </div>
              )}

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Reconstructed conversation</p>
              <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}` }}>
                {scenario.transcript.map((m, i) => (<ChatBubble key={i} who={m.who} text={m.text} name={m.name} />))}
              </div>

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Conversation state</p>
              <div className="mb-4"><ConvStateBadge stateKey={scenario.conversationState} /></div>
              {scenario.recommendation && (
                <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.layer4Tint }}>
                  <p className="text-sm font-semibold" style={{ color: COLORS.layer4Deep }}>You don't need to force another topic.</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.recommendation}</p>
                </div>
              )}

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Conversation review</p>
              <div className="rounded-2xl p-4 mb-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Overall</span>
                  <span className="font-display" style={{ fontSize: 22, color: COLORS.accent }}>{scenario.grading.overall}%</span>
                </div>
                <div className="space-y-2.5">
                  <LabeledBar label="Depth" percent={scenario.grading.depth} color={DIM_COLORS.depth} />
                  <LabeledBar label="Active listening" percent={scenario.grading.activeListening} color={DIM_COLORS.listening} />
                  <LabeledBar label="Reciprocity" percent={scenario.grading.reciprocity} color={DIM_COLORS.reciprocity} />
                  <LabeledBar label="Naturalness" percent={scenario.grading.naturalness} color={COLORS.teal} />
                </div>
                {typeof scenario.grading.goalImpact === 'number' && <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Goal progress: <span style={{ color: COLORS.good, fontWeight: 700 }}>+{scenario.grading.goalImpact}%</span></p>}
              </div>

              <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>What went well</p>
                {scenario.wentWell.map((w, i) => (<p key={i} className="text-xs mb-0.5" style={{ color: COLORS.good }}>✓ {w}</p>))}
                <p className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.ink }}>Opportunity</p>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>{scenario.opportunity}</p>
                <p className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.ink }}>Try next time</p>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>{scenario.tryNextTime}</p>
              </div>

              {scenario.encourager && <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>Encourager use</p>
                <p className="text-xs font-medium" style={{ color: scenario.encourager.type === 'good' ? COLORS.good : COLORS.alert }}>{scenario.encourager.type === 'good' ? 'Good use' : 'Could improve'}: {scenario.encourager.line}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{scenario.encourager.why}</p>
              </div>}

              {scenario.emotionalCues.length > 0 && <div className="rounded-2xl p-4 mb-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>Possible emotional cues</p>
                {scenario.emotionalCues.map((e, i) => (
                  <p key={i} className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{e.emoji} {e.text}</p>
                ))}
                <p className="text-xs mt-2 italic" style={{ color: COLORS.inkSoft }}>These are possible interpretations, not facts.</p>
              </div>}

              {scenario.extractedInfo.length > 0 && (
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Information mentioned</p>
                  {unsavedInfo.length > 1 && onApproveInfoAll && <button type="button" onClick={saveAllInfo} className="flex items-center gap-1.5 text-xs font-semibold rounded-full pl-3 pr-1.5 py-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Save all {unsavedInfo.length} <Kbd>S</Kbd></button>}
                </div>
              )}
              {scenario.extractedInfo.map((it, i) => {
                const status = infoStatus[i];
                const cat = categoryMeta(it.category);
                return (
                  <div key={i} className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                    <div className="flex items-center gap-2">
                      <span>{cat.emoji}</span>
                      {editingIndex === i ? (
                        <input autoFocus value={infoDrafts[i]} onChange={e => setInfoDrafts(d => ({ ...d, [i]: e.target.value }))} className="flex-1 text-sm rounded-lg px-2 py-1" style={{ border: `1px solid ${COLORS.accent}` }} />
                      ) : (
                        <p className="text-sm flex-1" style={{ color: COLORS.ink }}>{infoDrafts[i]}</p>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{it.name ? `About ${it.name} · ` : ''}Category: {cat.label}{it.temporary ? ' (temporary)' : ''}{it.when ? ` · 🗓️ ${formatCalendarDate(parseISODay(it.when))}` : ''}</p>
                    {status === 'saved' || status === 'reminded' ? (
                      <p className="text-xs mt-1.5 font-medium flex items-center gap-1 flex-wrap" style={{ color: COLORS.good }}><Check size={11} /> Saved to {it.personId ? nameOf(it.personId) : scenarioPerson ? scenarioPerson.name : 'profile'}
                        {status === 'reminded' ? ', with a reminder the day after' : it.when && onRemindAbout && <button type="button" onClick={() => remindInfoItem(i)} className="font-semibold ml-2" style={{ color: COLORS.accent }}>Remind me after</button>}
                      </p>
                    ) : status === 'ignored' ? (
                      <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Ignored</p>
                    ) : (
                      <div className="flex items-center gap-3 mt-1.5">
                        <button onClick={() => saveInfoItem(i)} disabled={!String(infoDrafts[i] || '').trim()} className="text-xs font-semibold" style={{ color: String(infoDrafts[i] || '').trim() ? COLORS.accent : COLORS.inkSoft }}>Save</button>
                        {it.when && <button onClick={() => saveInfoItem(i, { remind: true })} disabled={!String(infoDrafts[i] || '').trim()} className="text-xs font-semibold" style={{ color: String(infoDrafts[i] || '').trim() ? COLORS.accent : COLORS.inkSoft }}>Save and remind me after</button>}
                        <button onClick={() => setEditingIndex(i)} className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Edit</button>
                        <button onClick={() => ignoreInfoItem(i)} className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Ignore</button>
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="text-sm font-semibold mt-4 mb-2" style={{ color: COLORS.ink }}>What to say next</p>
              {scenario.next.continueTopic && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Continue the current topic</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.continueTopic.text}</p>
                  <Tones item={scenario.next.continueTopic} />
                </div>
              )}
              {scenario.next.shareYourself && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Share something yourself</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.shareYourself.text}</p>
                  <Tones item={scenario.next.shareYourself} />
                </div>
              )}
              {scenario.next.changeTopic && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Change topic naturally</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.changeTopic.text}</p>
                  <Tones item={scenario.next.changeTopic} />
                </div>
              )}
              {scenario.next.dontMessage && (
                <div className="rounded-2xl p-3.5 mb-2" style={{ background: COLORS.layer4Tint }}>
                  <p className="text-xs font-semibold" style={{ color: COLORS.layer4Deep }}>Don't message yet</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.ink }}>{scenario.next.dontMessage.text}</p>
                  <Tones item={scenario.next.dontMessage} intro="If you'd still like to say something, keep it light and closing:" />
                </div>
              )}

              {scenario.own ? (
                <div className="rounded-2xl p-4 mt-5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Log it">
                  <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Log it</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>📱 Messaged {scenario.log.personIds.map(nameOf).join(', ')} · {ML_LABELS[scenario.log.meaningfulness - 1]} ({scenario.log.meaningfulness} of 5)</p>
                  <div className="flex items-center gap-2 flex-wrap mt-2.5">
                    <DateDropdown key={`${scenarioKey}:${scenario.log.date}`} compact value={ownLogDate} onChange={setOwnLogDate} maxDate={new Date()} />
                    <span className="text-xs" style={{ color: COLORS.inkSoft }}>{ownChat && ownChat.source ? "the conversation's day" : scenario.log.date ? "from the chat's times" : 'no times in the chat, so today'}</span>
                  </div>
                  {DIM_ORDER.some(k => scenario.log.ratings[k]) && <p className="text-xs mt-2.5" style={{ color: COLORS.ink }}>{DIM_ORDER.filter(k => scenario.log.ratings[k]).map(k => `${DIM_LABELS[k]} ${scenario.log.ratings[k]}`).join(' · ')}</p>}
                  {scenario.log.activeListening.length > 0 && <p className="text-xs mt-1.5" style={{ color: COLORS.good }}>✓ {scenario.log.activeListening.map(k => AL_ITEMS.find(a => a.key === k).label).join(' · ')}</p>}
                  {scenario.log.summary && <p className="text-xs mt-1.5 italic" style={{ color: COLORS.inkSoft }}>Note: {scenario.log.summary}</p>}
                  <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>The log keeps this review and the chat, to read again from the Journal.</p>
                  {logged
                    ? <p className="text-sm text-center font-medium mt-3" style={{ color: COLORS.good }}>✓ Logged</p>
                    : <button type="button" onClick={logOwn} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-3 mt-3" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Log this chat <Kbd onAccent>L</Kbd></button>}
                </div>
              ) : <div className="mt-5">
                {logged ? (
                  <p className="text-sm text-center font-medium" style={{ color: COLORS.good }}>✓ Logged and updated {scenarioPerson ? scenarioPerson.name : 'their'} progress</p>
                ) : (
                  <button onClick={handleLogAnalysis} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Log this as an interaction <Kbd onAccent>L</Kbd></button>
                )}
              </div>}
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
