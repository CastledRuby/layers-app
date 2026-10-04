// The five-tab bottom navigation bar. Today (the calendar) sits in the
// centre, as Layers' main screen and the one it opens on; People holds the
// map of how close you are to everyone. Ctrl+1–5 follow this order (TABS in
// data/constants.js).

import { BookOpen, CalendarDays, MessageCircle, User, Users } from 'lucide-react';
import { TABS } from '../data/constants.js';
import { COLORS } from '../theme.js';

const ITEMS = {
  coach: { label: 'Coach', Icon: MessageCircle },
  people: { label: 'People', Icon: Users },
  today: { label: 'Today', Icon: CalendarDays },
  journal: { label: 'Journal', Icon: BookOpen },
  me: { label: 'Me', Icon: User },
};

export function BottomNav({ active, onChange }) {
  return (
    <div className="nav-bar">
      {TABS.map(key => {
        const it = ITEMS[key];
        const isActive = active === key;
        return (
          <button key={key} onClick={() => onChange(key)} className="nav-btn" style={{ color: isActive ? COLORS.accent : COLORS.inkSoft }}>
            <it.Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
            <span style={{ fontWeight: isActive ? 700 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
