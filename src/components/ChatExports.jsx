// "From your chats" in Coach's Analyse: the chats in the Layers chats folder
// (lib/chatImport.js), each with its new conversations, newest first. A
// conversation is new until you analyse it, or, for a chat Layers hasn't seen
// before, if it's from the last two weeks. Picking one fills the analysis
// card (onPick). Chats with nobody from your circle are tucked away.

import { useState } from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { Avatar } from './atoms.jsx';
import { getLayer } from '../data/constants.js';
import { chatRows, conversationLabel } from '../lib/chatImport.js';
import { COLORS } from '../theme.js';

const SOURCE = { whatsapp: { emoji: '💬', label: 'WhatsApp' }, instagram: { emoji: '📷', label: 'Instagram' } };

function Help({ folder }) {
  return (
    <div className="text-xs mt-2 space-y-1.5" style={{ color: COLORS.inkSoft }}>
      <p><span className="font-semibold" style={{ color: COLORS.ink }}>WhatsApp:</span> on your phone, open the chat → Export chat → Without media → Save to Files → OneDrive → {folder}. It shows here a few seconds after OneDrive brings it down.</p>
      <p><span className="font-semibold" style={{ color: COLORS.ink }}>Instagram:</span> Accounts Centre → Your information and permissions → Download your information → just Messages, as JSON, for the last week or so. Save the zip in the same folder (unzipped is fine too).</p>
      <p>Snapchat and iMessage don't export chats: those will be screenshots, in the phone app.</p>
    </div>
  );
}

// initialOpen: a chat to show opened (from the week review).
export function ChatExports({ state, people, yourName, progress, folder = 'Documents → Layers chats', onPick, onPickMe, onOpenFolder, initialOpen = null }) {
  const [open, setOpen] = useState(initialOpen); // the chat shown
  const [showEarlier, setShowEarlier] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [help, setHelp] = useState(false);
  const [now] = useState(() => Date.now()); // "new" is reckoned from when this was opened
  const card = { background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` };

  const rows = chatRows(state ? state.chats : [], { people, yourName, progress, now });
  const yours = rows.filter(r => r.ids.length);
  const others = rows.filter(r => !r.ids.length);

  function renderRow(row) {
    const { chat, owner, ids, convs, fresh } = row;
    const isOpen = open === chat.key;
    const who = ids.map(id => people.find(p => p.id === id)).filter(Boolean);
    const shown = showEarlier ? convs : fresh;
    const names = [...new Set([...chat.participants, ...chat.messages.map(m => m.sender)])];
    return (
      <div key={chat.key} className="rounded-xl mt-1.5" style={{ border: `1px solid ${isOpen ? COLORS.accent : COLORS.line}` }}>
        <button type="button" onClick={() => { setOpen(isOpen ? null : chat.key); setShowEarlier(false); }} aria-expanded={isOpen} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
          <span aria-hidden="true">{SOURCE[chat.source].emoji}</span>
          <span className="flex-1 min-w-0">
            <span className="text-sm font-semibold block truncate" style={{ color: COLORS.ink }}>{chat.title}</span>
            <span className="text-xs" style={{ color: COLORS.inkSoft }}>{SOURCE[chat.source].label}{who.length ? ` · ${who.map(p => p.name).join(', ')}` : ''}</span>
          </span>
          {who.slice(0, 3).map(p => <Avatar key={p.id} person={p} size={22} ringColor={getLayer(p.layer).color} />)}
          <span className="text-xs font-semibold shrink-0" style={{ color: fresh.length ? COLORS.accent : COLORS.inkSoft }}>{fresh.length ? `${fresh.length} new` : 'Nothing new'}</span>
          <ChevronRight size={14} color={COLORS.inkSoft} style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />
        </button>
        {isOpen && (
          <div className="px-3 pb-3">
            {!owner ? (
              <>
                <p className="text-xs font-semibold mb-1.5" style={{ color: COLORS.ink }}>Which of these is you?</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map(n => <button key={n} type="button" onClick={() => onPickMe(chat.key, n)} className="chip" style={{ padding: '4px 10px' }}>{n}</button>)}
                </div>
              </>
            ) : (
              <>
                {shown.length === 0 && <p className="text-xs" style={{ color: COLORS.inkSoft }}>Nothing new since you last analysed this chat. Export it again after you've talked.</p>}
                {shown.slice(0, showEarlier ? 30 : 10).map(conv => {
                  const opener = conv.messages.find(m => m.sender !== owner) || conv.messages[0];
                  return (
                    <button key={conv.start} type="button" onClick={() => onPick(chat, conv, owner)} className="w-full text-left rounded-lg px-2.5 py-2 mt-1" style={{ background: COLORS.paper }}>
                      <span className="text-xs font-semibold block" style={{ color: COLORS.ink }}>{conversationLabel(conv)}</span>
                      <span className="text-xs block truncate" style={{ color: COLORS.inkSoft }}>{opener.sender}: {opener.text}</span>
                    </button>
                  );
                })}
                {convs.length > fresh.length && <button type="button" onClick={() => setShowEarlier(v => !v)} className="text-xs font-semibold mt-2" style={{ color: COLORS.accent }}>{showEarlier ? 'Only new ones' : `Earlier conversations (${convs.length - fresh.length})`}</button>}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3.5 mb-4" style={card} aria-label="From your chats">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold flex-1" style={{ color: COLORS.ink }}>From your chats</p>
        <button type="button" onClick={() => setHelp(v => !v)} className="text-xs font-semibold" style={{ color: COLORS.accent }} aria-expanded={help}>How to add one</button>
        {onOpenFolder && <button type="button" onClick={onOpenFolder} className="flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.accent }}><FolderOpen size={13} />Folder</button>}
      </div>
      {!state && <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Reading your chats…</p>}
      {state && !rows.length && <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Export a chat into the Layers chats folder and its conversations show here, ready to analyse.</p>}
      {(help || (state && !rows.length)) && <Help folder={folder} />}
      {state && state.problems.map(p => <p key={p.name} className="text-xs mt-1.5" role="alert" style={{ color: COLORS.alert }}>{p.name}: {p.error}</p>)}
      {yours.map(renderRow)}
      {others.length > 0 && (
        <>
          <button type="button" onClick={() => setShowOthers(v => !v)} className="text-xs font-semibold mt-2.5" style={{ color: COLORS.inkSoft }} aria-expanded={showOthers}>{showOthers ? 'Hide' : 'Show'} chats with people not in Layers ({others.length})</button>
          {showOthers && others.map(renderRow)}
        </>
      )}
    </div>
  );
}
