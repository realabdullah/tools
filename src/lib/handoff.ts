/**
 * In-memory hand-off between the root input surface and a workspace.
 *
 * Deliberately not the URL and not storage: pasted content may be a live token,
 * and tool content must never end up in history, bookmarks or a referrer.
 * The value is consumed exactly once, on the receiving workspace's first render.
 */
let pending: string | null = null;

export const setPendingInput = (value: string): void => {
  pending = value;
};

export const takePendingInput = (): string | null => {
  const value = pending;
  pending = null;
  return value;
};
