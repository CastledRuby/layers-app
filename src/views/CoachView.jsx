// Conversation Coach tab: Prepare and Analyse.
// Keys (no sheet open, not typing): 1 Prepare, 2 Analyse; on Prepare, ← →
// who you're about to talk to, L logs the conversation with them, A
// analyses a chat with them, O opens their profile.

import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, X } from 'lucide-react';
import { Avatar, ChatBubble, ConvStateBadge, Kbd, LabeledBar, LayerBadge } from '../components/atoms.jsx';
import { hasOpenSheet, isTyping } from '../components/sheetLayer.js';
import { ANALYSIS_MODEL_NAME, analysisCost, analysisRequest, analysisResult, MAX_SCREENSHOTS } from '../lib/analysis.js';
import { isPictureFile } from '../data/avatars.js';
import { loadPhoto, shrinkForAnalysis } from '../lib/photo.js';
import { categoryMeta, DIM_COLORS, getLayer } from '../data/constants.js';
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

// analysisReady: 'none' (no desktop bridge), 'no-key' or 'ready', for
// analysing your own chat with Claude (onAnalyse sends the request built by
// lib/analysis.js and resolves to { result, usage } or { error }).
export function CoachView({ people, journal, initialPersonId, initialTab, onOpenLog, onApproveInfo, onLogFromAnalysis, onOpenPerson, analysisReady = 'none', onAnalyse, onOpenMe, yourName = '' }) {
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
  const [ownResult, setOwnResult] = useState(null);
  const [ownCost, setOwnCost] = useState(null);
  const [ownError, setOwnError] = useState(null);
  const shotsInput = useRef(null);
  // Counts analyses, so an answer that arrives after you've moved on (another
  // person, or back to the list) is dropped, and each one is its own session.
  const ownRun = useRef(0);

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
  const scenario = scenarioKey ? (scenarioKey.startsWith('own') ? ownResult : SCENARIOS[scenarioKey]) : null;
  const scenarioPerson = people.find(p => p.id === analysisPersonId) || null;
  const sessionKey = scenarioPerson && scenarioKey ? `${scenarioPerson.id}:${scenarioKey}` : null;
  const session = (sessionKey && sessions[sessionKey]) || { infoStatus: {}, logged: false };
  const infoStatus = session.infoStatus;
  const logged = session.logged;
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
  function resetAnalyse() { ownRun.current += 1; setStep('pick'); setScenarioKey(null); }
  async function addShots(files) {
    const pictures = [...files].filter(isPictureFile).slice(0, MAX_SCREENSHOTS - ownShots.length);
    const loaded = (await Promise.all(pictures.map(async file => { const img = await loadPhoto(file); return img ? { id: `${file.name}${file.size}${Math.random()}`, name: file.name, src: img.src, img } : null; }))).filter(Boolean);
    setOwnShots(list => [...list, ...loaded].slice(0, MAX_SCREENSHOTS));
    setOwnError(loaded.length < pictures.length ? "Some of those aren't pictures Layers can read." : null);
  }
  // Sends your chat to Claude (only now), then shows its answer like a sample's.
  async function analyseOwn() {
    if (!onAnalyse || !scenarioPerson || (!ownText.trim() && !ownShots.length)) return;
    const run = ++ownRun.current;
    const person = scenarioPerson;
    setOwnError(null);
    setStep('asking');
    const images = ownShots.map(s => shrinkForAnalysis(s.img)).filter(Boolean);
    const answer = await Promise.resolve(onAnalyse(analysisRequest({ person, yourName, text: ownText, images }))).catch(() => null);
    if (run !== ownRun.current) return;
    if (!answer || answer.error) { setOwnError((answer && answer.error) || "Couldn't analyse that chat."); setStep('pick'); return; }
    const result = analysisResult(answer.result, person);
    setOwnResult(result);
    setOwnCost(analysisCost(answer.usage));
    setInfoDrafts(Object.fromEntries(result.extractedInfo.map((it, i) => [i, it.text])));
    setEditingIndex(null);
    setScenarioKey(`own:${run}`);
    setStep('results');
    setOwnText(''); setOwnShots([]);
  }
  function changeAnalysisPerson() { setAnalysisPersonId(null); resetAnalyse(); }
  function saveInfoItem(i) {
    const it = scenario.extractedInfo[i];
    const text = String(infoDrafts[i] || '').trim();
    if (!text) return;
    onApproveInfo(scenarioPerson.id, it.category, text, it.temporary);
    updateSession(s => ({ infoStatus: { ...s.infoStatus, [i]: 'saved' } }));
    setEditingIndex(null);
  }
  function ignoreInfoItem(i) { updateSession(s => ({ infoStatus: { ...s.infoStatus, [i]: 'ignored' } })); setEditingIndex(null); }
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || hasOpenSheet() || isTyping()) return;
      const el = document.activeElement;
      if (el && el.tagName === 'BUTTON' && e.key === 'Enter') return;
      const key = e.key.toLowerCase();
      const act = (fn) => { e.preventDefault(); fn(); };
      if (e.key === '1') { act(() => setTab('prepare')); return; }
      if (e.key === '2') { act(() => setTab('analyse')); return; }
      if (tab !== 'prepare' || !preparePerson) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && people.length > 1) {
        act(() => {
          const i = people.findIndex(p => p.id === preparePerson.id);
          setPreparePersonId(people[(i + (e.key === 'ArrowLeft' ? people.length - 1 : 1)) % people.length].id);
        });
      } else if (key === 'l') act(() => onOpenLog(preparePerson.id));
      else if (key === 'a') act(() => { if (preparePerson.id !== analysisPersonId) resetAnalyse(); setAnalysisPersonId(preparePerson.id); setTab('analyse'); });
      else if (key === 'o') act(() => onOpenPerson(preparePerson.id));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function handleLogAnalysis() {
    if (logged) return;
    onLogFromAnalysis(scenarioPerson.id, scenario);
    updateSession(() => ({ logged: true }));
  }

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Conversation Coach</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>Noticing, responding and adapting, not scripts.</p>

      <div className="flex items-center gap-2 mt-4">
        {[{ k: 'prepare', label: 'Prepare' }, { k: 'analyse', label: 'Analyse a chat' }].map((t, i) => (
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
            <button onClick={() => { const id = preparePerson ? preparePerson.id : null; if (id !== analysisPersonId) resetAnalyse(); setAnalysisPersonId(id); setTab('analyse'); }} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full py-3 text-center" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Analyse a screenshot <Kbd>A</Kbd></button>
          </div>

          <p className="text-xs text-center mt-5" style={{ color: COLORS.inkSoft }}>Good social skills are about noticing, responding and adapting, not forcing a particular outcome.</p>
        </div>
      )}

      {tab === 'analyse' && (
        <div className="mt-5">
          {people.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Add someone in the People tab first, then come back to analyse a conversation with them.</p>
          ) : !scenarioPerson ? (
            <>
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
                  {analysisReady === 'ready' && (
                    <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Your own chat">
                      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Analyse your own chat</p>
                      <textarea value={ownText} onChange={e => { setOwnText(e.target.value); setOwnError(null); }} aria-label="The chat" rows={5}
                        placeholder={`Paste a chat with ${scenarioPerson.name}, or add screenshots below.`} className="w-full text-sm rounded-xl px-3 py-2.5 mt-2" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />
                      <input ref={shotsInput} type="file" accept="image/*" multiple hidden aria-label="Add screenshots" onChange={e => { const files = e.target.files ? [...e.target.files] : []; e.target.value = ''; addShots(files); }} />
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {ownShots.map(s => (
                          <span key={s.id} className="relative">
                            <img src={s.src} alt={s.name} className="rounded-lg" style={{ width: 44, height: 64, objectFit: 'cover', border: `1px solid ${COLORS.line}` }} />
                            <button type="button" onClick={() => setOwnShots(list => list.filter(x => x.id !== s.id))} aria-label={`Remove ${s.name}`} className="absolute flex items-center justify-center rounded-full" style={{ top: -6, right: -6, width: 20, height: 20, background: COLORS.ink }}><X size={11} color={COLORS.paper} /></button>
                          </span>
                        ))}
                        {ownShots.length < MAX_SCREENSHOTS && <button type="button" onClick={() => shotsInput.current && shotsInput.current.click()} className="chip"><ImagePlus size={14} color={COLORS.accent} /> Screenshots</button>}
                      </div>
                      <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>Pressing Analyse sends this chat, and only this chat, to Anthropic for {ANALYSIS_MODEL_NAME} to read (about US$0.03). {scenarioPerson.name}'s name and yours are hidden in pasted text; screenshots go as they are.</p>
                      {ownError && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: COLORS.alert }}>{ownError}</p>}
                      <button type="button" onClick={analyseOwn} disabled={!ownText.trim() && !ownShots.length} className="w-full text-sm font-semibold rounded-full py-2.5 mt-3" style={{ background: COLORS.accent, color: COLORS.onAccent, opacity: !ownText.trim() && !ownShots.length ? 0.5 : 1 }}>Analyse with Claude</button>
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
              <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>Claude is reading the chat…</p>
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
              {scenario.own && ownCost && <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Read by {ANALYSIS_MODEL_NAME}: this one cost {ownCost}. These are a coach's suggestions, not facts.</p>}

              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Reconstructed conversation</p>
              <div className="rounded-2xl p-3.5 mb-4" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}` }}>
                {scenario.transcript.map((m, i) => (<ChatBubble key={i} who={m.who} text={m.text} />))}
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
                <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Goal progress: <span style={{ color: COLORS.good, fontWeight: 700 }}>+{scenario.grading.goalImpact}%</span></p>
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

              {scenario.extractedInfo.length > 0 && <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Information mentioned</p>}
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
                    <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Category: {cat.label}{it.temporary ? ' (temporary)' : ''}</p>
                    {status === 'saved' ? (
                      <p className="text-xs mt-1.5 font-medium" style={{ color: COLORS.good }}><Check size={11} /> Saved to {scenarioPerson ? scenarioPerson.name : 'profile'}</p>
                    ) : status === 'ignored' ? (
                      <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Ignored</p>
                    ) : (
                      <div className="flex items-center gap-3 mt-1.5">
                        <button onClick={() => saveInfoItem(i)} disabled={!String(infoDrafts[i] || '').trim()} className="text-xs font-semibold" style={{ color: String(infoDrafts[i] || '').trim() ? COLORS.accent : COLORS.inkSoft }}>Save</button>
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

              <div className="mt-5">
                {logged ? (
                  <p className="text-sm text-center font-medium" style={{ color: COLORS.good }}>✓ Logged and updated {scenarioPerson ? scenarioPerson.name : 'their'} progress</p>
                ) : (
                  <button onClick={handleLogAnalysis} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Log this as an interaction</button>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
