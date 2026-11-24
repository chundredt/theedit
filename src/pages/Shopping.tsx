import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ListChecks, Plus, ShoppingCart, X, Printer } from 'lucide-react';
import { Banner, Card, Empty, Field, Modal, MoneyInput, PageHeader } from '../components/ui';
import { DateInput } from '../components/DateInput';
import { getToday, useData, useStore } from '../data/store';
import { useUI, go } from '../lib/ui-state';
import { buildShoppingList, type ListItem } from '../domain/shopping';
import { groceryOverview } from '../domain/grocery';
import { periodKeyFor } from '../domain/period';
import { addDays, fmtDate, grams, mondayOf, money } from '../lib/format';
import type { ID } from '../domain/types';

export function ShoppingPage() {
  const data = useData();
  const today = getToday();
  const { week, setWeek } = useUI();
  const st = useStore.getState();
  const state = data.shopping[week] || { week, checked: [], storeOverride: {}, extras: [] };
  const list = useMemo(() => buildShoppingList(data, data.mealPlans[week], today, state.storeOverride), [data, week, today, state.storeOverride]);
  const g = groceryOverview(data, periodKeyFor(today, data.settings.periodStartDay), today);
  const [extra, setExtra] = useState('');
  const [completing, setCompleting] = useState(false);
  const [groupBy, setGroupBy] = useState<'aisle' | 'store'>('aisle');
  const allowance = g.weeklyNow || g.weekly;
  const within = list.total <= allowance + 0.004;
  const checkedCount = list.items.filter((i) => state.checked.includes(i.product.id)).length + state.extras.filter((e) => e.checked).length;
  const totalCount = list.items.length + state.extras.length;

  const groups = useMemo(() => {
    const m = new Map<string, ListItem[]>();
    for (const it of list.items) {
      const k = groupBy === 'aisle' ? it.product.category : it.chosen?.store.name || 'No price yet';
      m.set(k, [...(m.get(k) || []), it]);
    }
    return [...m.entries()];
  }, [list.items, groupBy]);

  return (
    <>
      <PageHeader title="Shopping list" sub="Built from your meal plan, minus what's already in the pantry.">
        <div className="period-nav">
          <button className="btn ghost icon sm" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week"><ChevronLeft /></button>
          <div className="lbl">Week of {fmtDate(week).slice(0, 5)}<small>{week === mondayOf(today) ? 'This week' : fmtDate(week)}</small></div>
          <button className="btn ghost icon sm" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week"><ChevronRight /></button>
        </div>
        <button className="btn hide-sm" onClick={() => window.print()}><Printer /> Print</button>
        <button className="btn primary" disabled={!list.items.length && !state.extras.length} onClick={() => setCompleting(true)}><ShoppingCart /> Finish shop</button>
      </PageHeader>

      {list.items.length === 0 && list.fromPantry.length === 0 ? (
        <Card><Empty icon={<ListChecks />} title="Nothing to buy yet" action={<button className="btn primary" onClick={() => go('meals')}>Plan this week's meals</button>}>Choose meals in the planner and the list builds itself.</Empty></Card>
      ) : (
        <>
          <div className="grid g-4">
            <div className="card stat"><div className="label">Estimated total</div><div className="value" data-testid="list-total">{money(list.total)}</div><div className="hint">{list.items.length} items · whole packs</div></div>
            <div className="card stat"><div className="label">Weekly allowance</div><div className="value">{money(allowance)}</div><div className={`hint ${within ? 'good' : 'danger'}`}>{within ? `${money(allowance - list.total)} under` : `${money(list.total - allowance)} over`}</div></div>
            <div className="card stat"><div className="label">Grocery budget left after</div><div className={`value ${g.remaining - list.total < 0 ? 'danger' : ''}`}>{money(g.remaining - list.total)}</div><div className="hint">of {money(g.budget, { cents: false })} this month</div></div>
            <div className="card stat"><div className="label">Saved by specials</div><div className="value good">{money(list.specialsSaving)}</div><div className="hint">vs normal prices</div></div>
          </div>
          {!within && <div className="mt-16"><Banner tone="warn">This list is over your weekly allowance. Swap a dinner for a cheaper recipe (lentils, pilchards, eggs and soya mince are the best protein per rand), or use what's in your pantry.</Banner></div>}
          {list.unpriced > 0 && <div className="mt-16"><Banner>{list.unpriced} item{list.unpriced === 1 ? ' has' : 's have'} no price yet, so the total is understated. <a href="#/prices">Add prices</a>.</Banner></div>}

          <div className="grid g-main mt-16" style={{ alignItems: 'start' }}>
            <div className="stack">
              <div className="row between"><span className="muted small">{checkedCount} of {totalCount} ticked</span>
                <div className="seg"><button className={groupBy === 'aisle' ? 'on' : ''} onClick={() => setGroupBy('aisle')}>By aisle</button><button className={groupBy === 'store' ? 'on' : ''} onClick={() => setGroupBy('store')}>By store</button></div>
              </div>
              {groups.map(([name, items]) => (
                <Card key={name} title={name} action={<span className="muted small num">{money(items.reduce((s, i) => s + (i.chosen?.cost || 0), 0))}</span>}>
                  {items.map((it) => {
                    const done = state.checked.includes(it.product.id);
                    return (
                      <div key={it.product.id} className={`shop-item ${done ? 'done' : ''}`}>
                        <button className={`tick ${done ? 'on' : ''}`} onClick={() => st.toggleShopping(week, it.product.id)} aria-label={`${done ? 'Untick' : 'Tick'} ${it.product.name}`} aria-pressed={done}>{done && <Check />}</button>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="title" style={{ fontWeight: 600 }}>{it.product.name} {it.chosen?.isSpecial && <span className="chip good">Special</span>}</div>
                          <div className="muted xs">
                            Need {grams(it.toBuy, it.product)}{it.inPantry > 0 ? ` (have ${grams(it.inPantry, it.product)})` : ''}
                            {it.chosen && <> · buy {it.chosen.packs} × {grams(it.chosen.record.packSize)}</>}
                            {it.leftover > 0 && <> · {grams(it.leftover, it.product)} left over</>}
                          </div>
                          <div className="muted xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>For {it.usedBy.join(', ')}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {it.chosen ? (
                            <>
                              <b className="num">{money(it.chosen.cost)}</b>
                              <select className="input sm" style={{ height: 28, fontSize: 12, padding: '0 6px', marginTop: 2, maxWidth: 150 }} value={it.chosen.store.id} onChange={(e) => st.setStoreOverride(week, it.product.id, e.target.value)} aria-label={`Store for ${it.product.name}`}>
                                {it.options.map((o) => <option key={o.store.id} value={o.store.id}>{o.store.name} {money(o.cost)}{o.store.id === it.recommended?.id ? ' ★' : ''}</option>)}
                              </select>
                            </>
                          ) : <a className="small" href="#/prices">Add price</a>}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              ))}
              <Card title="Extras">
                {state.extras.map((e) => (
                  <div key={e.id} className={`shop-item ${e.checked ? 'done' : ''}`}>
                    <button className={`tick ${e.checked ? 'on' : ''}`} onClick={() => st.toggleExtra(week, e.id)} aria-label={`Tick ${e.name}`}>{e.checked && <Check />}</button>
                    <span className="grow title">{e.name}</span>
                    <button className="btn ghost icon sm" onClick={() => st.removeExtra(week, e.id)} aria-label={`Remove ${e.name}`}><X /></button>
                  </div>
                ))}
                <form className="row mt-8" onSubmit={(ev) => { ev.preventDefault(); if (extra.trim()) { st.addExtra(week, extra.trim()); setExtra(''); } }}>
                  <input className="input" placeholder="Add something else (toothpaste, coffee…)" value={extra} onChange={(e) => setExtra(e.target.value)} />
                  <button className="btn" type="submit"><Plus /> Add</button>
                </form>
              </Card>
            </div>

            <div className="stack">
              <Card title="Where to shop">
                {list.byStore.map((s) => (
                  <div key={s.store.id} className="list-item">
                    <span className="store-dot" style={{ background: s.store.color, width: 12, height: 12 }} />
                    <div className="grow"><div className="title">{s.store.name}</div><div className="meta">{s.count} item{s.count === 1 ? '' : 's'}</div></div>
                    <b className="num">{money(s.total)}</b>
                  </div>
                ))}
                <p className="muted xs mt-8">★ = cheapest for the quantity you need. Change the store on any item if one shop is more convenient.</p>
              </Card>
              {list.fromPantry.length > 0 && (
                <Card title="Already in your pantry">
                  {list.fromPantry.map((n) => (
                    <div key={n.product.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{n.product.name}</span><span className="muted">{n.toBuy === 0 ? 'covered' : 'partly'} · {grams(Math.min(n.inPantry, n.required), n.product)}</span>
                    </div>
                  ))}
                </Card>
              )}
              {state.completedOn && <Banner tone="good">Shop recorded on {fmtDate(state.completedOn)}.</Banner>}
            </div>
          </div>
        </>
      )}
      {completing && <CompleteShop week={week} onClose={() => setCompleting(false)} byStore={list.byStore.map((s) => ({ id: s.store.id, name: s.store.name, est: s.total }))} />}
    </>
  );
}

function CompleteShop({ week, byStore, onClose }: { week: string; byStore: { id: ID; name: string; est: number }[]; onClose: () => void }) {
  const data = useData();
  const completeShop = useStore((s) => s.completeShop);
  const [amounts, setAmounts] = useState<Record<ID, number | ''>>(Object.fromEntries(byStore.map((s) => [s.id, s.est])));
  const [extraStore, setExtraStore] = useState<ID>('');
  const [date, setDate] = useState<string | undefined>(getToday());
  const [leftovers, setLeftovers] = useState(true);
  const [deduct, setDeduct] = useState(true);
  const rows = [...byStore, ...(extraStore && !byStore.some((b) => b.id === extraStore) ? [{ id: extraStore, name: data.stores.find((s) => s.id === extraStore)!.name, est: 0 }] : [])];
  const total = Object.values(amounts).reduce<number>((s, v) => s + (Number(v) || 0), 0);
  return (
    <Modal title="Finish shop" sub="Enter what you actually paid (from your till slip). This records the spend against your grocery budget." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!date || total <= 0} onClick={() => { completeShop(week, rows.map((r) => ({ storeId: r.id, amount: Number(amounts[r.id]) || 0 })), date!, { leftovers, deductPantry: deduct }); onClose(); }}>Record {money(total)}</button></>}>
      <div className="stack">
        {rows.map((r) => (
          <Field key={r.id} label={r.name} help={r.est ? `Estimated ${money(r.est)}` : undefined}>
            <MoneyInput value={amounts[r.id] ?? ''} onChange={(v) => setAmounts({ ...amounts, [r.id]: v })} ariaLabel={`Amount paid at ${r.name}`} />
          </Field>
        ))}
        <Field label="Shopped somewhere else too?">
          <select className="input" value={extraStore} onChange={(e) => setExtraStore(e.target.value)}><option value="">—</option>{data.stores.filter((s) => !byStore.some((b) => b.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </Field>
        <Field label="Date"><DateInput value={date} onChange={setDate} required /></Field>
        <label className="check"><input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} /> Use up the pantry items this week's meals need</label>
        <label className="check"><input type="checkbox" checked={leftovers} onChange={(e) => setLeftovers(e.target.checked)} /> Add leftover pack quantities of ticked items to the pantry</label>
      </div>
    </Modal>
  );
}
