import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useData } from '../data/store';
import { addShopping, clearBought, removeShoppingItem, toggleShoppingItem } from '../data/food-actions';
import { splitItems } from '../domain/food';

/** A plain checklist: type items, tick them off in the shop. */
export function ShoppingPage() {
  const data = useData();
  const [text, setText] = useState('');
  const open = data.shoppingList.filter((x) => !x.checked);
  const done = data.shoppingList.filter((x) => x.checked);
  const add = () => {
    addShopping(splitItems(text).length ? splitItems(text) : [text]);
    setText('');
  };
  return (
    <>
      <PageHeader title="Shopping list" sub={open.length ? `${open.length} to buy` : 'Nothing to buy yet.'} />
      <div className="stack" style={{ gap: 16, maxWidth: 640 }}>
        <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (text.trim()) add(); }}>
          <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add items, e.g. milk, eggs, bread" aria-label="Add to list" />
          <button className="btn primary icon" type="submit" aria-label="Add item" disabled={!text.trim()}><Plus /></button>
        </form>

        <section className="card">
          {open.length === 0 && done.length === 0 && <p className="muted">Type above, or use “Add to shopping list” on the Food log to pull in what you’ve planned.</p>}
          {open.map((i) => (
            <div key={i.id} className="check-row">
              <button className="round-check" aria-label={`Got ${i.name}`} onClick={() => toggleShoppingItem(i.id)} />
              <span className="grow" style={{ fontWeight: 600 }}>{i.name}</span>
              <button className="btn ghost icon sm" aria-label={`Remove ${i.name}`} onClick={() => removeShoppingItem(i.id)}><X /></button>
            </div>
          ))}
          {done.length > 0 && (
            <>
              <div className="row between mt-16" style={{ marginBottom: 4 }}>
                <span className="eyebrow">In the trolley</span>
                <button className="link" onClick={clearBought}>Clear</button>
              </div>
              {done.map((i) => (
                <div key={i.id} className="check-row">
                  <button className="round-check on" aria-label={`Undo ${i.name}`} onClick={() => toggleShoppingItem(i.id)}><Check /></button>
                  <span className="grow muted" style={{ textDecoration: 'line-through' }}>{i.name}</span>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}
