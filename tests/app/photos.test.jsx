/** @vitest-environment jsdom */
// Photos from a folder (docs/roadmap.md, "Drafted next (2026-10-06)", D7):
// choose a folder, go through its pictures picking who each is for, and add
// them all with one Undo. jsdom can't decode pictures or draw on a canvas,
// so lib/photo.js is stood in for: a "picture" 400 × 600, and a small JPEG
// made from its name.
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { faceCrop, startCrop } from '../../src/data/avatars.js';
import { dialog, nav, person, renderApp, savedPerson, seedState, toasts } from './harness.jsx';

// Windows' face detector is stood in for too: it finds a face in Kai.png.
const crops = vi.hoisted(() => new Map()); // the crop each picture was drawn with
vi.mock('../../src/lib/photo.js', () => ({
  MAX_PHOTO_BYTES: 25 * 1024 * 1024,
  loadPhoto: async (file) => ({ naturalWidth: 400, naturalHeight: 600, src: `data:image/png;base64,${btoa(file.name)}` }),
  renderPhoto: (img, crop) => { crops.set(img.src, { zoom: crop.zoom, x: crop.x, y: crop.y }); return `data:image/jpeg;base64,${img.src.split(',')[1]}`; },
  findFaces: async (files) => files.map(f => (f.name === 'Kai.png' ? { width: 400, height: 600, faces: [{ x: 150, y: 100, w: 100, h: 100 }] } : null)),
}));

describe('photos from a folder', () => {
  it('starts on the person a picture is named after, picks others by name, and adds them all with one Undo', async () => {
    seedState({ people: [person('Kai'), person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getByRole('button', { name: 'Add photos from a folder' }));
    const sheet = () => dialog('Photos from a folder');
    const files = [
      new File(['k'], 'Kai.png', { type: 'image/png' }),
      new File(['m'], 'IMG_2041.jpg', { type: 'image/jpeg' }),
      new File(['n'], 'notes.txt', { type: 'text/plain' }),
    ];
    await user.upload(within(sheet()).getByLabelText('Choose a folder of pictures'), files);
    expect(within(sheet()).getByLabelText('Which picture').textContent).toMatch(/Picture 1 of 2\s*· IMG_2041\.jpg/); // pictures only, by name
    await within(sheet()).findByRole('button', { name: /Skip this one/ }); // nobody yet: Enter would skip it
    await user.keyboard('mor{Enter}'); // finding Morgan, Enter picks them
    expect(within(sheet()).getByRole('button', { name: /Use for Morgan/ })).toBeTruthy();
    await user.keyboard('{Enter}');
    await within(sheet()).findByRole('button', { name: /Use for Kai/ }); // Kai.png starts on Kai
    await user.keyboard('{Enter}');
    expect(within(sheet()).getByRole('status', { name: 'Photos ready' }).textContent).toMatch(/2 photos ready/);
    await user.keyboard('{Enter}');

    expect(savedPerson('Kai').avatar).toEqual({ style: 'photo', src: `data:image/jpeg;base64,${btoa('Kai.png')}` });
    // Kai's picture started on the face Windows found; the other, with none, on its upper middle.
    expect(crops.get(`data:image/png;base64,${btoa('Kai.png')}`)).toEqual(faceCrop({ width: 400, height: 600, faces: [{ x: 150, y: 100, w: 100, h: 100 }] }, 400, 600));
    expect(crops.get(`data:image/png;base64,${btoa('IMG_2041.jpg')}`)).toEqual(startCrop(400, 600));
    expect(savedPerson('Morgan').avatar).toEqual({ style: 'photo', src: `data:image/jpeg;base64,${btoa('IMG_2041.jpg')}` });
    expect(toasts()).toContain('Photos added for Morgan and Kai');
    await user.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    expect(savedPerson('Kai').avatar).toBeUndefined();
    expect(savedPerson('Morgan').avatar).toBeUndefined();
  });

  it('Backspace goes back to change one, and a picture can be skipped', async () => {
    seedState({ people: [person('Kai'), person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getByRole('button', { name: 'Add photos from a folder' }));
    const sheet = () => dialog('Photos from a folder');
    await user.upload(within(sheet()).getByLabelText('Choose a folder of pictures'), [new File(['k'], 'Kai.png', { type: 'image/png' }), new File(['x'], 'Zed.png', { type: 'image/png' })]);
    await within(sheet()).findByRole('button', { name: /Use for Kai/ });
    await user.keyboard('{Enter}'); // Kai
    await within(sheet()).findByRole('button', { name: /Skip this one/ });
    await user.keyboard('{Backspace}'); // back to Kai.png, still Kai's
    await within(sheet()).findByRole('button', { name: /Use for Kai/ });
    await user.keyboard('2'); // the second person shown instead
    const picked = within(sheet()).getByRole('button', { name: /^Use for / }).textContent;
    await user.keyboard('{Enter}');
    await within(sheet()).findByRole('button', { name: /Skip this one/ });
    await user.keyboard('{Enter}'); // skip Zed.png
    expect(within(sheet()).getByRole('status', { name: 'Photos ready' }).textContent).toMatch(/1 photo ready/);
    await user.keyboard('{Enter}');
    const name = picked.includes('Morgan') ? 'Morgan' : 'Kai';
    expect(savedPerson(name).avatar.style).toBe('photo');
    expect(savedPerson(name === 'Kai' ? 'Morgan' : 'Kai').avatar).toBeUndefined();
  });
});
