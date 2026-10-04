// Slides a new page in, so it's clear which page you've opened: forward
// (from the right) to a tab further right or into a person or goals screen,
// back (from the left) otherwise. `order` is the page's place: the tab's
// position, or more for screens opened from a tab. Nothing moves on the
// first page, or with reduced motion (theme.js).

import { useState } from 'react';

export function PageTransition({ pageKey, order, children }) {
  const [shown, setShown] = useState({ key: pageKey, order, dir: null });
  if (shown.key !== pageKey) setShown({ key: pageKey, order, dir: order >= shown.order ? 'fwd' : 'back' });
  return (
    <div key={pageKey} className={shown.dir ? `page-anim--${shown.dir}` : undefined} data-page={pageKey}>
      {children}
    </div>
  );
}
