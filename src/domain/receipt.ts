import type { ID, ISODate, Product, Store } from './types';
import { matchProduct } from './flyer';

/** What a till slip says, whether read by Claude (from the photo) or by the text parser below. */
export interface Receipt {
  store?: string;
  date?: ISODate;
  total?: number;
  items: { name: string; price: number; quantity?: number; weightKg?: number | null; productId?: ID | null }[];
}

const SKIP = /\b(total|sub ?total|vat|tax|change|cash|card|tender|balance|due|rounding|savings?|you saved|discount summary|xtra|smart shopper|wrewards|points|visa|mastercard|approved|auth|ref|till|cashier|tel|vat no|thank)\b/i;
const MONEY_END = /(-?\d{1,5}[.,]\d{2})\s*[A-Z*]?\s*$/;

export function guessStore(text: string, stores: Store[]): Store | undefined {
  const t = text.toLowerCase();
  if (/food ?lover/.test(t)) return stores.find((s) => /food lover/i.test(s.name));
  return stores.find((s) => t.includes(s.name.toLowerCase()));
}

/** Read SA till-slip text (OCR output): item lines end in an amount; "2 @ 14.99" and "0.512 kg @ 89.99/kg" are understood. */
export function parseReceiptText(text: string): Receipt {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const r: Receipt = { items: [] };
  const dm = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})\b/) || text.match(/\b(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})\b/);
  if (dm) {
    const iso = dm[1].length === 4 ? `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}` : `${dm[3].length === 2 ? '20' + dm[3] : dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    if (!Number.isNaN(Date.parse(iso))) r.date = iso;
  }
  let pending: { quantity?: number; weightKg?: number } | null = null;
  let nameOnly: string | null = null; // a product name whose amount is on the next line
  for (const line of lines) {
    const total = line.match(/^(?:total|amount due|balance due)\b.*?(\d{1,5}[.,]\d{2})/i);
    if (total) { r.total = Number(total[1].replace(',', '.')); continue; }
    const multi = line.match(/^(\d+(?:[.,]\d+)?)\s*(kg)?\s*[@xX]\s*R?\s*(\d+[.,]\d{2})/i);
    if (multi && !/[a-z]{3}/i.test(line.replace(/kg/i, ''))) {
      pending = multi[2] ? { weightKg: Number(multi[1].replace(',', '.')) } : { quantity: Number(multi[1]) };
      // The amount may be on this line or the item line.
      const amt = line.match(MONEY_END);
      if (amt && nameOnly) {
        r.items.push({ name: nameOnly, price: Number(amt[1].replace(',', '.')), ...pending });
        nameOnly = null;
        pending = null;
      } else if (amt && r.items.length && !r.items[r.items.length - 1].quantity && !r.items[r.items.length - 1].weightKg) {
        // "2 @ 18.99" alone is the unit price — the line total is already on the item line.
        // With two amounts ("2 @ 18.99   37.98") the last one is the line total.
        const amounts = line.match(/\d+[.,]\d{2}/g) || [];
        Object.assign(r.items[r.items.length - 1], pending, amounts.length >= 2 ? { price: Number(amt[1].replace(',', '.')) } : {});
        pending = null;
      }
      continue;
    }
    if (SKIP.test(line)) continue;
    const m = line.match(MONEY_END);
    if (!m) {
      nameOnly = /[a-z]{3}/i.test(line) && !/\d{1,2}[/.-]\d{1,2}[/.-]\d{2}/.test(line) ? line.replace(/[*#]+/g, '').trim() : null;
      continue;
    }
    nameOnly = null;
    const price = Number(m[1].replace(',', '.'));
    const name = line.slice(0, m.index).replace(/\b\d{6,}\b/g, '').replace(/[*#]+/g, '').trim();
    if (!/[a-z]{2}/i.test(name) || price <= 0) continue;
    r.items.push({ name, price, ...(pending || {}) });
    pending = null;
  }
  return r;
}

export interface ReceiptRow {
  include: boolean;
  name: string;
  productId: ID;
  /** Price for `packSize` grams (unit price for counted items, per-kg price for weighed items). */
  price: number;
  packSize: number;
  note?: string;
}

/** Turn receipt lines into price rows: unit price for multiples, per-kg for weighed items, matched to your products. */
export function receiptRows(r: Receipt, products: Product[]): ReceiptRow[] {
  return r.items.map((it) => {
    const id = it.productId && products.some((p) => p.id === it.productId) ? it.productId : matchProduct(it.name, products).id;
    const p = products.find((x) => x.id === id);
    if (it.weightKg && it.weightKg > 0)
      return { include: !!p, name: it.name, productId: id || '', price: Math.round((it.price / it.weightKg) * 100) / 100, packSize: 1000, note: `${it.weightKg} kg weighed → per kg` };
    const qty = it.quantity && it.quantity > 1 ? it.quantity : 1;
    return { include: !!p, name: it.name, productId: id || '', price: Math.round((it.price / qty) * 100) / 100, packSize: p?.packSize || 500, note: qty > 1 ? `${qty} bought` : undefined };
  });
}
