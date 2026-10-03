// Small generic helpers.


export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

let uidCounter = 0;

export function uid() { uidCounter += 1; return `id-${Date.now().toString(36)}-${uidCounter}`; }
