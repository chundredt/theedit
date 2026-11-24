import type { ID, Product } from './types';

/**
 * Turns pasted catalogue text or OCR output from a flyer photo into candidate price rows.
 * Nothing is saved automatically: every row is shown for review first, because OCR and
 * catalogue layouts are messy.
 *
 * Understands lines such as:
 *   "Clover Full Cream Milk 2L R32.99"
 *   "Chicken Breast Fillets per kg R89,99"
 *   "Any 2 for R50 Koo Baked Beans 410g"
 *   "Woolworths Free Range Eggs 18s  Was R79.99 Now R64.99"
 *   a name line followed by a line containing only "R 24.99"
 */
export interface ParsedItem {
  raw: string;
  name: string;
  price: number;
  wasPrice?: number;
  packSize?: number; // grams / ml
  perKg: boolean;
  multiBuy?: { qty: number; total: number };
  matchId?: ID;
  confidence: number; // 0..1 for the product match
}

const PRICE_RE = /R\s?(\d{1,5}(?:[.,]\d{2})?)(?!\s?(?:g|kg|ml|l)\b)/gi;
const BARE_PRICE_RE = /^\s*(?:R\s?)?(\d{1,5}[.,]\d{2})\s*(?:each|ea)?\s*$/i;
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l|litre|liter)\b/i;
const COUNT_RE = /\b(\d{1,2})\s?(?:s|pack|pk|'s)\b/i;
const MULTI_RE = /(?:any\s+)?(\d)\s?(?:for|x)\s?R\s?(\d{1,5}(?:[.,]\d{2})?)/i;

const num = (s: string) => Number(s.replace(',', '.'));

export function parseSize(text: string): number | undefined {
  const m = text.match(SIZE_RE);
  if (!m) return undefined;
  const v = num(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'kg' || unit === 'l' || unit === 'litre' || unit === 'liter') return Math.round(v * 1000);
  return Math.round(v);
}

function cleanName(s: string): string {
  return s
    .replace(MULTI_RE, ' ')
    .replace(/\b(was|now|save|only|each|ea|per\s?kg|special|deal|price|any)\b/gi, ' ')
    .replace(/R\s?\d{1,5}(?:[.,]\d{2})?/gi, ' ')
    .replace(/[|•*:;~_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–,.]+|[\s\-–,.]+$/g, '')
    .trim();
}

const STOP = new Set(['sauce', 'tin', 'frozen', 'mix', 'large', 'small', 'the', 'and', 'with', 'of', 'in', 'for', 'fresh', 'pack', 'woolworths', 'checkers', 'ww', 'flm', 'sixty60', 'select', 'value', 'brand', 'g', 'kg', 'ml', 'l']);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t))
    .map((t) => (t.endsWith('es') && t.length > 4 ? t.slice(0, -2) : t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t));
}

/** Best product match by token overlap (Dice coefficient), weighted toward the product's own words. */
export function matchProduct(name: string, products: Product[]): { id?: ID; confidence: number } {
  const a = new Set(tokens(name));
  if (!a.size) return { confidence: 0 };
  let best: { id?: ID; confidence: number } = { confidence: 0 };
  for (const p of products) {
    const b = new Set(tokens(p.name));
    if (!b.size) continue;
    let hit = 0;
    for (const t of b) if (a.has(t)) hit++;
    const score = (hit / b.size) * 0.7 + ((2 * hit) / (a.size + b.size)) * 0.3;
    if (score > best.confidence) best = { id: p.id, confidence: score };
  }
  return best.confidence >= 0.34 ? best : { confidence: best.confidence };
}

export function parseCatalogueText(text: string, products: Product[]): ParsedItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out: ParsedItem[] = [];
  let pendingName: string | null = null;

  const push = (raw: string, nameSource: string, price: number, extra: Partial<ParsedItem> = {}) => {
    const name = cleanName(nameSource);
    if (!name || !/[a-z]/i.test(name) || !(price > 0)) return;
    let packSize = parseSize(raw);
    const count = raw.match(COUNT_RE);
    const perKg = /per\s?kg|\/kg|p\/kg/i.test(raw);
    if (perKg) packSize = 1000;
    const m = matchProduct(name, products);
    const prod = products.find((p) => p.id === m.id);
    if (!packSize && count && prod?.pieceGrams) packSize = Number(count[1]) * prod.pieceGrams;
    out.push({ raw, name, price, packSize: packSize || prod?.packSize, perKg, matchId: m.id, confidence: m.confidence, ...extra });
  };

  for (const line of lines) {
    const bare = line.match(BARE_PRICE_RE);
    if (bare && pendingName) {
      push(`${pendingName} ${line}`, pendingName, num(bare[1]));
      pendingName = null;
      continue;
    }
    const multi = line.match(MULTI_RE);
    const prices = [...line.matchAll(PRICE_RE)].map((m) => num(m[1]));
    if (multi) {
      const qty = Number(multi[1]);
      const total = num(multi[2]);
      const nameSrc = line.replace(MULTI_RE, ' ');
      push(line, cleanName(nameSrc) ? nameSrc : pendingName || '', Math.round((total / qty) * 100) / 100, { multiBuy: { qty, total } });
      pendingName = null;
      continue;
    }
    if (prices.length) {
      const nameSrc = cleanName(line) ? line : pendingName || '';
      const wasM = line.match(/was\s?R\s?(\d{1,5}(?:[.,]\d{2})?)/i);
      const nowM = line.match(/now\s?R\s?(\d{1,5}(?:[.,]\d{2})?)/i);
      const saveM = line.match(/save\s?R\s?(\d{1,5}(?:[.,]\d{2})?)/i);
      let price = nowM ? num(nowM[1]) : Math.min(...prices.filter((p) => !saveM || p !== num(saveM[1])));
      let wasPrice = wasM ? num(wasM[1]) : prices.length > 1 ? Math.max(...prices) : undefined;
      if (saveM && !wasM) wasPrice = price + num(saveM[1]);
      if (wasPrice !== undefined && wasPrice <= price) wasPrice = undefined;
      if (!Number.isFinite(price)) price = prices[0];
      push(line, nameSrc, price, { wasPrice });
      pendingName = null;
      continue;
    }
    // A line with words and no price might be a product name whose price is on the next line.
    pendingName = /[a-z]{3,}/i.test(line) && line.length < 80 ? line : null;
  }
  return out;
}
