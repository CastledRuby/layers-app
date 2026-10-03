// The five-tab bottom navigation bar.

import { BookOpen, Home, MessageCircle, User, Users } from 'lucide-react';
import { COLORS } from '../theme.js';

export function BottomNav({ active, onChange }) {
  const items = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'people', label: 'People', Icon: Users },
    { key: 'coach', label: 'Coach', Icon: MessageCircle },
    { key: 'journal', label: 'Journal', Icon: BookOpen },
    { key: 'me', label: 'Me', Icon: User },
  ];
  return (
    <div className="nav-bar">
      {items.map(it => {
        const isActive = active === it.key;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} className="nav-btn" style={{ color: isActive ? COLORS.accent : COLORS.inkSoft }}>
            <it.Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
            <span style={{ fontWeight: isActive ? 700 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
