import type { AppData, ID, ISODate, PriceRecord, Product, Store } from './types';
import { daysBetween } from '../lib/format';

/**
 * Prices are entered manually, parsed from pasted catalogue text, or extracted from flyer
 * photos. There are no live retailer feeds — Checkers, Food Lover's Market and Woolworths
 * don't publish public price APIs. A future integration implements this interface and
 * returns PriceRecords that are merged exactly like manually captured ones.
 */
export interface PriceSourceAdapter {
  id: string;
  label: string;
  fetchPrices(storeId: ID, since?: ISODate): Promise<Omit<PriceRecord, 'id'>[]>;
}

export const STALE_DAYS = 30;

export function isSpecialActive(p: PriceRecord, today: ISODate): boolean {
  return p.isSpecial && (!p.specialEnds || p.specialEnds >= today);
}

/** A record is usable if it's a regular price or a special that hasn't expired. */
export function isUsable(p: PriceRecord, today: ISODate): boolean {
  return !p.isSpecial || isSpecialActive(p, today);
}

export interface StorePrice {
  store: Store;
  record: PriceRecord;
  /** Price per kg (or litre). */
  perKg: number;
  isSpecial: boolean;
  stale: boolean;
  /** The regular price at this store, if known, when the current price is a special. */
  regular?: PriceRecord;
}

/** The current price per store for a product: an active special beats the latest regular price. */
export function storePrices(data: AppData, productId: ID, today: ISODate): StorePrice[] {
  const out: StorePrice[] = [];
  for (const store of data.stores) {
    const recs = data.prices.filter((p) => p.productId === productId && p.storeId === store.id && isUsable(p, today));
    if (!recs.length) continue;
    const specials = recs.filter((r) => r.isSpecial).sort((a, b) => a.price / a.packSize - b.price / b.packSize);
    const regulars = recs.filter((r) => !r.isSpecial).sort((a, b) => b.verifiedOn.localeCompare(a.verifiedOn));
    const record = specials[0] || regulars[0];
    out.push({
      store,
      record,
      perKg: (record.price / record.packSize) * 1000,
      isSpecial: record.isSpecial,
      stale: daysBetween(record.verifiedOn, today) > STALE_DAYS,
      regular: specials[0] ? regulars[0] : undefined,
    });
  }
  return out.sort((a, b) => a.perKg - b.perKg);
}

export function bestPrice(data: AppData, productId: ID, today: ISODate): StorePrice | undefined {
  return storePrices(data, productId, today)[0];
}

/** Rand per gram at the cheapest store (used for recipe cost per serving). */
export function costPerGram(data: AppData, productId: ID, today: ISODate): number | undefined {
  const b = bestPrice(data, productId, today);
  return b ? b.record.price / b.record.packSize : undefined;
}

export interface ActiveSpecial {
  record: PriceRecord;
  product: Product;
  store: Store;
  saving?: number;
  savingPct?: number;
  daysLeft?: number;
}

export function activeSpecials(data: AppData, today: ISODate): ActiveSpecial[] {
  const prod = new Map(data.products.map((p) => [p.id, p]));
  const st = new Map(data.stores.map((s) => [s.id, s]));
  return data.prices
    .filter((p) => isSpecialActive(p, today) && prod.has(p.productId) && st.has(p.storeId))
    .map((record) => {
      const regular = data.prices
        .filter((p) => !p.isSpecial && p.productId === record.productId && p.storeId === record.storeId)
        .sort((a, b) => b.verifiedOn.localeCompare(a.verifiedOn))[0];
      let was = record.wasPrice;
      if (!was && regular) was = (regular.price / regular.packSize) * record.packSize;
      const saving = was && was > record.price ? was - record.price : undefined;
      return {
        record,
        product: prod.get(record.productId)!,
        store: st.get(record.storeId)!,
        saving,
        savingPct: saving && was ? (saving / was) * 100 : undefined,
        daysLeft: record.specialEnds ? daysBetween(today, record.specialEnds) : undefined,
      };
    })
    .sort((a, b) => (b.savingPct || 0) - (a.savingPct || 0));
}
