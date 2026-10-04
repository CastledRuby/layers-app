// The Rings brand drawn in the app's theme colours, so it follows light and
// dark mode (branding/README.md). The logo files themselves are rendered by
// scripts/render-brand.cjs; these are the in-app versions.

import { COLORS } from '../theme.js';

const LAYER = [COLORS.layer1, COLORS.layer2, COLORS.layer3, COLORS.layer4];
// Soft discs: each layer's colour mixed into the surface, in either theme.
const TINT = LAYER.map(c => `color-mix(in srgb, ${c} 30%, ${COLORS.paperRaised})`);

// The People tab with nobody yet: the four layers drawn dashed, waiting,
// with you at the centre and an empty seat on the outer ring.
export function RingsEmpty({ width = 220 }) {
  return (
    <svg viewBox="0 0 320 220" width={width} height={(width * 220) / 320} aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
      {[100, 74, 48, 22].map((r, i) => (
        <circle key={r} cx="160" cy="110" r={r} fill="none" stroke={LAYER[i]} strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
      ))}
      <circle cx="160" cy="110" r="9" fill={COLORS.accent} />
      <circle cx="230.7" cy="39.3" r="15" fill={COLORS.paperRaised} stroke={LAYER[0]} strokeWidth="2.5" strokeDasharray="4 4" />
      <path d="M230.7 33.3 V45.3 M224.7 39.3 H236.7" stroke={LAYER[0]} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Onboarding: the four layers as soft discs, with people placed on them.
export function RingsWelcome({ width = 260 }) {
  const at = (r, deg) => [180 + r * Math.cos((deg * Math.PI) / 180), 120 + r * Math.sin((deg * Math.PI) / 180)];
  const people = [[98, -35, 0], [98, 160, 0], [70, 40, 1], [42, -120, 2], [23, 205, 3]];
  return (
    <svg viewBox="0 0 360 240" width={width} height={(width * 240) / 360} aria-hidden="true" style={{ display: 'block' }}>
      {[112, 84, 56, 28].map((r, i) => <circle key={r} cx="180" cy="120" r={r} fill={TINT[i]} />)}
      <circle cx="180" cy="120" r="9" fill={COLORS.accent} />
      {people.map(([r, deg, layer]) => {
        const [x, y] = at(r, deg);
        return <circle key={`${r}-${deg}`} cx={x} cy={y} r="11" fill={LAYER[layer]} stroke={COLORS.paperRaised} strokeWidth="3" />;
      })}
    </svg>
  );
}
