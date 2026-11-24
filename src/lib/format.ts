import type { ISODate } from '../domain/types';

/** R2,345.50 — the format SA banking apps use. */
export function money(value: number, opts: { cents?: boolean; sign?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  const v = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  const abs = Math.abs(v);
  const s = abs.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const sign = v < 0 ? '−' : opts.sign && v > 0 ? '+' : '';
  return `${sign}R${s}`;
}

/** Compact money for tight spaces: R12.4k */
export function moneyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '−' : ''}R${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 10_000) return `${value < 0 ? '−' : ''}R${(abs / 1000).toFixed(1)}k`;
  return money(value, { cents: false });
}

/**
 * Parse user-entered amounts: "2000", "2,000.50", "2 000,50", "R 1 250", "1250,5".
 * Returns NaN when nothing sensible can be read.
 */
export function parseAmount(input: string | number): number {
  if (typeof input === 'number') return input;
  let s = input.trim().replace(/^r\s*/i, '').replace(/[\s ]/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever comes last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // "1,250" (thousands) vs "12,50" (decimal): two trailing digits → decimal.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

export function fmtPct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

/** DD/MM/YYYY */
export function fmtDate(iso?: ISODate): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthName(m: number, short = false) {
  return (short ? MONTHS_SHORT : MONTHS)[m];
}

/** "Tue 24 Nov" */
export function fmtDay(iso: ISODate): string {
  const d = toDate(iso);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function dayName(iso: ISODate, short = true): string {
  const d = toDate(iso);
  const n = DAYS_SHORT[d.getDay()];
  return short ? n : ({ Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' } as Record<string, string>)[n];
}

/** Local-time date helpers (no time-zone drift: everything is a calendar day). */
export function toDate(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
}

export function mondayOf(iso: ISODate): ISODate {
  const d = toDate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function grams(g: number, piece?: { pieceGrams?: number; pieceLabel?: string }): string {
  if (piece?.pieceGrams && piece.pieceLabel) {
    const n = g / piece.pieceGrams;
    const rounded = Math.round(n * 2) / 2;
    return `${rounded} ${piece.pieceLabel}${rounded === 1 ? '' : 's'}`;
  }
  if (g >= 1000) return `${round2(g / 1000)} kg`;
  return `${Math.round(g)} g`;
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';
  return `${n}${s}`;
}
