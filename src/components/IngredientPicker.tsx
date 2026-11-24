import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useData, useStore } from '../data/store';
import { tokens } from '../domain/flyer';
import { guessProduct, lookupNutrition, nutritionFromSimilar } from '../domain/ingredients';
import type { ID } from '../domain/types';

/**
 * Add a new ingredient in one step: aisle and diet tags are guessed from the name, nutrition is
 * estimated from a similar ingredient straight away, then filled in from the Open Food Facts
 * database in the background (when online).
 */
export function useQuickProduct() {
  const saveProduct = useStore((s) => s.saveProduct);
  return (name: string): ID => {
    const { data } = useStore.getState();
    const clean = name.trim().replace(/^./, (c) => c.toUpperCase());
    const existing = data.products.find((p) => p.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;
    const g = guessProduct(clean);
    const estimate = nutritionFromSimilar(clean, data.products);
    const id = saveProduct({ name: clean, category: g.category, packSize: g.packSize, tags: g.tags, nutrition: estimate ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }, nutritionSource: estimate ? 'similar' : undefined });
    lookupNutrition(clean).then((n) => {
      const now = useStore.getState().data.products.find((p) => p.id === id);
      if (n && now && now.nutritionSource !== 'you') useStore.getState().saveProduct({ ...now, nutrition: n, nutritionSource: 'database' });
    });
    return id;
  };
}

/** Type to search your ingredients; if it's not there, add it with one tap. */
export function IngredientPicker({ value, onChange }: { value: ID; onChange: (id: ID) => void }) {
  const products = useData().products;
  const quick = useQuickProduct();
  const current = products.find((p) => p.id === value);
  const [q, setQ] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | undefined>(undefined);
  const query = q ?? current?.name ?? '';
  const matches = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t || (current && t === current.name.toLowerCase())) return [];
    const words = tokens(t);
    return products
      .map((p) => {
        const n = p.name.toLowerCase();
        const score = n.startsWith(t) ? 3 : n.includes(t) ? 2 : words.length && words.every((w) => tokens(p.name).some((x) => x.startsWith(w))) ? 1 : 0;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
      .slice(0, 6)
      .map((x) => x.p);
  }, [query, products, current]);
  const exact = products.some((p) => p.name.toLowerCase() === query.trim().toLowerCase());
  const pick = (id: ID) => { onChange(id); setQ(null); setOpen(false); };

  return (
    <div className="ing-picker">
      <input className="input sm" value={query} placeholder="Type an ingredient…" aria-label="Ingredient"
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => { setOpen(false); setQ(null); }, 150); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) pick(matches[0].id); else if (query.trim()) pick(quick(query)); } }} />
      {open && query.trim() && (matches.length > 0 || !exact) && (
        <div className="ing-menu" onMouseDown={(e) => { e.preventDefault(); window.clearTimeout(blurTimer.current); }}>
          {matches.map((p) => <button type="button" key={p.id} onClick={() => pick(p.id)}>{p.name}<span className="muted xs">{p.category}</span></button>)}
          {!exact && <button type="button" className="ing-add" onClick={() => pick(quick(query))}><Plus size={14} /> Add “{query.trim()}”</button>}
        </div>
      )}
    </div>
  );
}
