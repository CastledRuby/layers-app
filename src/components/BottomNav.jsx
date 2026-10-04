// The five-tab bottom navigation bar. Today (the calendar) sits in the
// centre, as Layers' main screen and the one it opens on; People holds the
// map of how close you are to everyone. Ctrl+1–5 follow this order (TABS in
// data/constants.js).
//
// The tab you're on sits on a glowing pill (.nav-indicator) that slides
// across when you switch, a ring ripples out from it and its icon hops; the
// styles are in theme.js. The page itself slides in (PageTransition.jsx).

import { BookOpen, CalendarDays, MessageCircle, User, Users } from 'lucide-react';
import { TABS } from '../data/constants.js';

const ITEMS = {
  coach: { label: 'Coach', Icon: MessageCircle },
  people: { label: 'People', Icon: Users },
  today: { label: 'Today', Icon: CalendarDays },
  journal: { label: 'Journal', Icon: BookOpen },
  me: { label: 'Me', Icon: User },
};

export function BottomNav({ active, onChange }) {
  const index = TABS.indexOf(active);
  return (
    <nav className="nav-bar" aria-label="Pages">
      {index >= 0 && <span className="nav-indicator" aria-hidden="true" style={{ transform: `translateX(${index * 100}%)` }} />}
      {TABS.map(key => {
        const it = ITEMS[key];
        const isActive = active === key;
        return (
          <button key={key} type="button" onClick={() => onChange(key)} aria-current={isActive ? 'page' : undefined} className={`nav-btn${isActive ? ' nav-btn--on' : ''}`}>
            {isActive && <span className="nav-ripple" aria-hidden="true" />}
            <span className="nav-icon"><it.Icon size={20} strokeWidth={isActive ? 2.5 : 2} /></span>
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
