import { useMemo, useState } from 'react';
import { Archive, Plus, Trash2 } from 'lucide-react';
import { Card, Empty, Field, Modal, PageHeader } from '../components/ui';
import { DateInput } from '../components/DateInput';
import { ProductSelect } from '../components/FoodForms';
import { RecipeDetail } from '../components/RecipeBits';
import { getToday, useData, useStore } from '../data/store';
import { suggestRecipes } from '../domain/recipes';
import { daysBetween, fmtDate, grams, money } from '../lib/format';
import { PRODUCT_CATEGORIES, type PantryItem, type Recipe } from '../domain/types';

function expiryChip(expiry: string | undefined, today: string) {
  if (!expiry) return <span className="chip">No expiry</span>;
  const d = daysBetween(today, expiry);
  if (d < 0) return <span className="chip danger">Expired {fmtDate(expiry)}</span>;
  if (d === 0) return <span className="chip danger">Expires today</span>;
  if (d <= 3) return <span className="chip warn">Use within {d} day{d === 1 ? '' : 's'}</span>;
  return <span className="chip">Best before {fmtDate(expiry)}</span>;
}

export function PantryPage() {
  const data = useData();
  const today = getToday();
  const [editing, setEditing] = useState<PantryItem | 'new' | null>(null);
  const [view, setView] = useState<Recipe | null>(null);
  const del = useStore((s) => s.deletePantry);
  const products = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const items = data.pantry.filter((p) => products.has(p.productId));
  const expired = items.filter((i) => i.expiry && i.expiry < today);
  const soon = items.filter((i) => i.expiry && i.expiry >= today && daysBetween(today, i.expiry) <= 3);
  const ideas = useMemo(() => suggestRecipes(data, today).filter((s) => s.pantryHits.length >= 2).sort((a, b) => b.expiringHits.length - a.expiringHits.length || b.pantryHits.length - a.pantryHits.length).slice(0, 6), [data, today]);
  const byCat = PRODUCT_CATEGORIES.map((c) => [c, items.filter((i) => products.get(i.productId)!.category === c).sort((a, b) => (a.expiry || '9').localeCompare(b.expiry || '9'))] as const).filter(([, l]) => l.length);

  return (
    <>
      <PageHeader title="Pantry" sub="What's already at home — used first by the shopping list and meal suggestions.">
        <button className="btn primary" onClick={() => setEditing('new')}><Plus /> Add item</button>
      </PageHeader>
      <div className="grid g-3">
        <div className="card stat"><div className="label">Items at home</div><div className="value">{items.length}</div></div>
        <div className="card stat"><div className="label">Use within 3 days</div><div className={`value ${soon.length ? 'warn' : ''}`}>{soon.length}</div></div>
        <div className="card stat"><div className="label">Expired</div><div className={`value ${expired.length ? 'danger' : ''}`}>{expired.length}</div><div className="hint">Ignored by the shopping list</div></div>
      </div>
      <div className="grid g-main mt-16" style={{ alignItems: 'start' }}>
        <div className="stack">
          {items.length === 0 ? <Card><Empty icon={<Archive />} title="Your pantry is empty" action={<button className="btn primary" onClick={() => setEditing('new')}><Plus /> Add item</button>}>Add staples you already have so you don't buy them twice. Leftovers from a finished shop are added automatically.</Empty></Card> :
            byCat.map(([cat, list]) => (
              <Card key={cat} title={cat}>
                {list.map((i) => {
                  const p = products.get(i.productId)!;
                  return (
                    <div key={i.id} className="list-item">
                      <button className="grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0 }} onClick={() => setEditing(i)}>
                        <div className="title">{p.name}</div>
                        <div className="meta">{grams(i.quantity, p)}{p.pieceGrams ? ` (${grams(i.quantity)})` : ''} · added {fmtDate(i.addedOn)}</div>
                      </button>
                      {expiryChip(i.expiry, today)}
                      <button className="btn ghost icon sm" onClick={() => del(i.id)} aria-label={`Remove ${p.name}`}><Trash2 /></button>
                    </div>
                  );
                })}
              </Card>
            ))}
        </div>
        <Card title="Cook with what you have">
          {ideas.length === 0 ? <p className="muted small">Add a few pantry items to get recipe ideas that use them up.</p> : ideas.map((s) => (
            <button key={s.recipe.id} className="list-item" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => setView(s.recipe)}>
              <span style={{ fontSize: 24 }}>{s.recipe.emoji}</span>
              <div className="grow">
                <div className="title">{s.recipe.name}</div>
                <div className="meta">Uses {s.pantryHits.slice(0, 3).join(', ')}{s.pantryHits.length > 3 ? '…' : ''}</div>
                {s.expiringHits.length > 0 && <span className="chip warn mt-8">Uses {s.expiringHits[0]} before it expires</span>}
              </div>
              <span className="muted xs nowrap">{money(s.stats.costPerServing)}</span>
            </button>
          ))}
        </Card>
      </div>
      {editing && <PantryForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {view && <RecipeDetail recipe={view} onClose={() => setView(null)} onEdit={() => setView(null)} onPlan={() => { location.hash = 'meals'; }} />}
    </>
  );
}

export function PantryForm({ initial, onClose }: { initial?: PantryItem; onClose: () => void }) {
  const data = useData();
  const { savePantry, deletePantry, toast } = useStore.getState();
  const [productId, setProductId] = useState(initial?.productId || '');
  const p = data.products.find((x) => x.id === productId);
  const [unit, setUnit] = useState<'g' | 'piece'>(p?.pieceGrams && initial && initial.quantity % p.pieceGrams === 0 ? 'piece' : 'g');
  const [qty, setQty] = useState<number | ''>(initial ? (unit === 'piece' && p?.pieceGrams ? initial.quantity / p.pieceGrams : initial.quantity) : '');
  const [expiry, setExpiry] = useState<string | undefined>(initial?.expiry);
  const [touched, setTouched] = useState(false);
  const ok = productId && Number(qty) > 0;
  const save = () => {
    setTouched(true);
    if (!ok) return;
    const grams = unit === 'piece' && p?.pieceGrams ? Number(qty) * p.pieceGrams : Number(qty);
    savePantry({ id: initial?.id, productId, quantity: grams, expiry, addedOn: initial?.addedOn });
    toast(initial ? 'Pantry updated' : `${p?.name} added to pantry`);
    onClose();
  };
  return (
    <Modal title={initial ? 'Edit pantry item' : 'Add to pantry'} onClose={onClose} footer={<>
      {initial && <button className="btn danger left" onClick={() => { deletePantry(initial.id); onClose(); }}><Trash2 /> Remove</button>}
      <button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button>
    </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Product" className="full" error={touched && !productId ? 'Choose a product' : ''}><ProductSelect value={productId} allowEmpty="Choose…" onChange={(v) => { setProductId(v); const np = data.products.find((x) => x.id === v); if (!initial && np) setQty(np.pieceGrams ? '' : np.packSize); if (np?.pieceGrams) setUnit('piece'); else setUnit('g'); }} /></Field>
        <Field label="Quantity" error={touched && !(Number(qty) > 0) ? 'Enter a quantity' : ''} help={p && unit === 'g' ? `A pack is ${grams(p.packSize)}` : undefined}>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value ? Number(e.target.value) : '')} aria-label="Quantity" />
            <select className="input" style={{ width: 110 }} value={unit} onChange={(e) => setUnit(e.target.value as 'g' | 'piece')} aria-label="Unit">
              <option value="g">g / ml</option>{p?.pieceGrams && <option value="piece">{p.pieceLabel}s</option>}
            </select>
          </div>
        </Field>
        <Field label="Expiry date (optional)"><DateInput value={expiry} onChange={setExpiry} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
