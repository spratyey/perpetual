/**
 * Whether the shared demo key has anything left.
 *
 * The keys dialog is hidden while the demo key is working, because a visitor
 * should not be asked for a credential to try something. But it has to come
 * back the moment the budget runs out, or the message telling people to add
 * their own key points at a button that is not there.
 *
 * Set from the proxy's 429, which is the only thing that actually knows.
 */

let exhausted = false;
const listeners = new Set<() => void>();

export function markSharedKeyExhausted(): void {
  if (exhausted) return;
  exhausted = true;
  listeners.forEach((l) => l());
}

export function isSharedKeyExhausted(): boolean {
  return exhausted;
}

export function subscribeSharedKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
