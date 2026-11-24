import { create } from 'zustand';

/**
 * Privacy mode: when on, every rand amount renders as "R •••" and money fields are blurred
 * until tapped. It switches on each time the app opens (unless turned off in Settings),
 * so glancing at your phone next to someone doesn't show your finances.
 */
let hidden = false;
export const amountsHidden = () => hidden;

interface PrivacyState {
  hidden: boolean;
  setHidden(v: boolean): void;
}

export const usePrivacy = create<PrivacyState>((set) => ({
  hidden: false,
  setHidden(v) {
    hidden = v;
    document.documentElement.classList.toggle('amounts-hidden', v);
    set({ hidden: v });
  },
}));

export const MASK = 'R •••';
