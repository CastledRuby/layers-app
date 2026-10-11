// Moving a plan by dragging it (decided 2026-10-11): what a drag carries and
// how a drop target reads it. A plan's row on Today or its block in the week
// view is dragged; a day in the week strip or month, or a day's column in the
// week view, takes it. Your own plans only (not Google Calendar's), and not
// ones already done or that didn't happen.

const TYPE = 'application/x-layers-plan';

export const canDragPlan = (item) => !!item && item.ev && item.ev.source !== 'google' && !item.done && !item.missed;

// On dragstart: { eventId, day } plus, from the week view, how far down the
// block it was grabbed (offsetY, px), so a drop lands where the block's top is.
export function startPlanDrag(e, item, offsetY = 0) {
  e.dataTransfer.setData(TYPE, JSON.stringify({ eventId: item.ev.id, day: item.day, offsetY }));
  e.dataTransfer.effectAllowed = 'move';
}
export const isPlanDrag = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes(TYPE);
export function readPlanDrag(e) {
  try {
    const v = JSON.parse(e.dataTransfer.getData(TYPE));
    return v && typeof v.eventId === 'string' && typeof v.day === 'string' ? v : null;
  } catch { return null; }
}
