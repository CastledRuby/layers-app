/** @vitest-environment jsdom */
// Key-caps (Kbd): Enter, Shift and Backspace are drawn as icons, since the key
// font drew ↵ as a stray box ("Ctrl+↵" on Analyse with Claude, 2026-10-11).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Kbd } from '../../src/components/atoms.jsx';

describe('key-caps', () => {
  it('draws ↵, ⇧ and ⌫ as icons, keeping the rest as text', () => {
    const { container } = render(<><Kbd>Ctrl+↵</Kbd><Kbd>⇧↵</Kbd><Kbd>⌫</Kbd><Kbd>Esc</Kbd></>);
    const [ctrlEnter, shiftEnter, back, esc] = container.querySelectorAll('.kbd');
    expect(ctrlEnter.textContent).toBe('Ctrl+');
    expect(ctrlEnter.querySelectorAll('svg.kbd-icon')).toHaveLength(1);
    expect(shiftEnter.querySelectorAll('svg.kbd-icon')).toHaveLength(2);
    expect(back.querySelectorAll('svg.kbd-icon')).toHaveLength(1);
    expect(back.textContent).toBe('');
    expect(esc.textContent).toBe('Esc');
    expect(esc.querySelector('svg')).toBeNull();
  });
});
