export type KeypadScreen = 'contacts' | 'amount' | 'review' | 'pin';
export const CONTACT_PAGE_SIZE = 9;
export const HOLD_TO_ASK_MS = 700;

export function canHoldToAsk(screen: string) {
  return screen === 'contacts' || screen === 'amount' || screen === 'review';
}

export function contactKeyIndex(key: string, page: number, count: number): number | null {
  if (!/^[1-9]$/.test(key) || !Number.isInteger(page) || page < 0) return null;
  const index = page * CONTACT_PAGE_SIZE + Number(key) - 1;
  return index < count ? index : null;
}

// The practice screen has no digit value: only an in-memory tap count.
export function demoTapCount(count: number, action: 'tap' | 'delete' | 'reset') {
  if (action === 'reset') return 0;
  return Math.max(0, Math.min(4, count + (action === 'tap' ? 1 : -1)));
}
