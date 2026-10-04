// People tab: your circle, grouped by layer.

import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Avatar, LayerBadge, ProgressBar } from '../components/atoms.jsx';
import { getLayer, LAYERS } from '../data/constants.js';
import { sortHistory } from '../lib/dates.js';
import { getCheckInSuggestions } from '../lib/text.js';
import { COLORS } from '../theme.js';

export function PeopleView({ people, journal, onOpenPerson, onAddPerson }) {
  const [view, setView] = useState('map');
  const [query, setQuery] = useState('');
  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter(p => p.name.toLowerCase().includes(q)) : people;
  }, [people, query]);
  const layersWithPeople = LAYERS.map(l => ({ ...l, people: filteredPeople.filter(p => p.layer === l.id) }));
  const radiusByLayer = { 4: 0.25, 3: 0.44, 2: 0.63, 1: 0.86 };
  const rotationOffset = { 1: 0, 2: 26, 3: 11, 4: 40 };
  const overviewData = useMemo(() => {
    const withTrend = filteredPeople.map(p => {
      // Points are per-layer percentages; newer ones also record their layer,
      // so a level-up (Layer 2 at 95% -> Layer 3 at 5%) reads as a rise.
      let trend = 'flat';
      const hist = sortHistory(p.history || []);
      if (hist.length >= 2) {
        const position = (h) => ((h.layer || p.layer) - 1) * 100 + h.value;
        const last = position(hist[hist.length - 1]);
        const prev = position(hist[hist.length - 2]);
        trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
      }
      return { ...p, trend };
    }).sort((a, b) => (b.layer - a.layer) || (b.overall - a.overall));
    const avg = filteredPeople.length ? Math.round(filteredPeople.reduce((s, p) => s + p.overall, 0) / filteredPeople.length) : 0;
    const trendingUp = withTrend.filter(p => p.trend === 'up').length;
    const needsAttention = getCheckInSuggestions(filteredPeople, journal || []);
    return { ranked: withTrend, avg, trendingUp, needsAttention };
  }, [filteredPeople, journal]);

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Your circle</p>
          <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{people.length} relationships, at a glance</p>
        </div>
        <button onClick={onAddPerson} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
          <UserPlus size={14} /> Add
        </button>
      </div>

      {people.length === 0 ? (
        <div className="rounded-2xl p-5 mt-6 text-center" style={{ background: COLORS.paperRaised, border: `1px dashed ${COLORS.line}` }}>
          <span style={{ fontSize: 26 }}>🧭</span>
          <p className="text-sm font-semibold mt-2" style={{ color: COLORS.ink }}>Your circle is empty</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Add the first person you'd like to be more intentional about, and place them wherever your relationship is today.</p>
          <button onClick={onAddPerson} className="text-xs font-semibold rounded-full px-4 py-2 mt-3.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Add your first person</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-4">
            <Search size={15} color={COLORS.inkSoft} className="shrink-0" />
            <input id="people-search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people..." aria-label="Search people" className="flex-1 text-sm rounded-xl px-3 py-2" style={{ border: `1px solid ${COLORS.line}` }} />
          </div>
          <div className="flex items-center gap-2 mt-3">
            {['map', 'list', 'overview'].map(v => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="text-xs font-semibold rounded-full px-3 py-1.5 capitalize" style={{ background: view === v ? COLORS.accent : COLORS.paperRaised, color: view === v ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${view === v ? COLORS.accent : COLORS.line}` }}>
                {v === 'map' ? 'Map view' : v === 'list' ? 'List view' : 'Overview'}
              </button>
            ))}
          </div>

          {filteredPeople.length === 0 ? (
            <p className="text-sm mt-6 text-center" style={{ color: COLORS.inkSoft }}>No one matches "{query}".</p>
          ) : view === 'map' ? (
            <>
              <div className="relative w-full mt-6" style={{ aspectRatio: '1 / 1' }}>
                <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
                  <circle cx="100" cy="100" r="95" fill={COLORS.layer1Tint} stroke={COLORS.layer1} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="72" fill={COLORS.layer2Tint} stroke={COLORS.layer2} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="50" fill={COLORS.layer3Tint} stroke={COLORS.layer3} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="28" fill={COLORS.layer4Tint} stroke={COLORS.layer4} strokeOpacity="0.45" strokeWidth="1" />
                  <circle cx="100" cy="100" r="15" fill={COLORS.accent} />
                  <text x="100" y="103.5" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700" fontFamily="Manrope, sans-serif">YOU</text>
                </svg>
                {layersWithPeople.flatMap(l => {
                  const n = l.people.length;
                  // Crowding scales two ways: avatars shrink as a ring fills
                  // up (more effective clearance at the same angular spread),
                  // and staggering moves to 3 alternating radii instead of 2
                  // once a ring is genuinely tight — plain angular spread
                  // alone runs out of room fast on the inner Layer 3/4 rings.
                  const avatarSize = n <= 3 ? 40 : n <= 5 ? 32 : n <= 7 ? 27 : 22;
                  const pillMaxWidth = n <= 3 ? 64 : n <= 5 ? 52 : 44;
                  return l.people.map((p, i) => {
                    const angle = (360 / n) * i + (rotationOffset[l.id] || 0);
                    const rad = angle * Math.PI / 180;
                    const staggerSteps = n > 6 ? [-1, 0, 1][i % 3] : n > 3 ? [1, -1][i % 2] : 0;
                    const stagger = staggerSteps * 0.055;
                    const rPct = (radiusByLayer[l.id] + stagger) * 50;
                    const left = 50 + rPct * Math.cos(rad);
                    const top = 50 + rPct * Math.sin(rad);
                    return (
                      <button key={p.id} onClick={() => onOpenPerson(p.id)} className="absolute flex flex-col items-center gap-1" style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)', zIndex: 10 + i }}>
                        <Avatar emoji={p.emoji} size={avatarSize} ringColor={l.color} />
                        <span className="text-xs font-medium rounded-full px-1.5 truncate" style={{ color: COLORS.ink, background: COLORS.paperRaised, boxShadow: `0 1px 3px rgba(0,0,0,0.15)`, maxWidth: pillMaxWidth, fontSize: n > 5 ? 10 : 12 }}>{p.name}</span>
                      </button>
                    );
                  });
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 16, rowGap: 8, marginTop: 20 }}>
                {LAYERS.map(l => (
                  <div key={l.id} className="flex items-center gap-1.5">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                    <span className="text-xs" style={{ color: COLORS.inkSoft }}>{l.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : view === 'list' ? (
            <div className="mt-5">
              {[...filteredPeople].sort((a, b) => (b.layer - a.layer) || (b.overall - a.overall)).map(p => {
                const l = getLayer(p.layer);
                return (
                  <button key={p.id} onClick={() => onOpenPerson(p.id)} className="w-full flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <Avatar emoji={p.emoji} size={44} ringColor={l.color} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.name}</p>
                      <div className="mt-1"><LayerBadge layerId={p.layer} /></div>
                    </div>
                    <span className="font-display shrink-0" style={{ fontSize: 18, color: l.color }}>{p.overall}%</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5">
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div>
                  <p className="font-display" style={{ fontSize: 22, color: COLORS.ink }}>{overviewData.avg}%</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>average progress</p>
                </div>
                <div>
                  <p className="font-display" style={{ fontSize: 22, color: COLORS.good }}>{overviewData.trendingUp}</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>trending up</p>
                </div>
                <div>
                  <p className="font-display" style={{ fontSize: 22, color: COLORS.warn }}>{overviewData.needsAttention.length}</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>may need attention</p>
                </div>
              </div>
              {overviewData.needsAttention.length > 0 && (
                <p className="text-xs rounded-xl p-3 mb-4" style={{ background: COLORS.layer3Tint, color: COLORS.layer3Deep }}>💡 Haven't checked in for a while: {overviewData.needsAttention.join(', ')}.</p>
              )}
              {overviewData.ranked.map(p => {
                const l = getLayer(p.layer);
                return (
                  <button key={p.id} onClick={() => onOpenPerson(p.id)} className="w-full text-left mb-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar emoji={p.emoji} size={28} ringColor={l.color} />
                      <span className="text-sm font-semibold flex-1" style={{ color: COLORS.ink }}>{p.name}</span>
                      {p.trend === 'up' && <span aria-label="trending up" className="text-sm font-semibold" style={{ color: COLORS.good }}>↑</span>}
                      {p.trend === 'down' && <span aria-label="trending down" className="text-sm font-semibold" style={{ color: COLORS.alert }}>↓</span>}
                      <span className="font-display" style={{ fontSize: 16, color: l.color }}>{p.overall}%</span>
                    </div>
                    <ProgressBar percent={p.overall} color={l.color} height={6} />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        {LAYERS.slice().reverse().map(l => (
          <div key={l.id} className="mb-2 rounded-xl p-3" style={{ background: l.tint }}>
            <p className="text-xs font-semibold" style={{ color: l.deep }}>Layer {l.id}: {l.fullName}</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{l.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
