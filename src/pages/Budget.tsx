import { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { Banner, Card, Confirm, Field, Modal, MoneyInput, PageHeader, PeriodNav } from '../components/ui';
import { BillList } from '../components/BudgetBits';
import { IncomeCard } from '../components/IncomeCard';
import { getToday, useData, useStore } from '../data/store';
import { usePeriod } from '../lib/ui-state';
import { resolveBudget, summarize, type CategoryRow } from '../domain/budget';
import { periodKeyFor, periodLabel, periodStart, shiftPeriod } from '../domain/period';
import { PAYMENT_METHODS, type Category, type CategoryGroup, type PaymentMethod } from '../domain/types';
import { fmtDate, fmtPct, money, ordinal } from '../lib/format';
import { PALETTE } from '../data/seed';

const GROUPS: { id: CategoryGroup; title: string; blurb: string; color: string }[] = [
  { id: 'fixed', title: 'Fixed expenses', blurb: 'Rent, debit orders and recurring bills', color: 'var(--series-2)' },
  { id: 'variable', title: 'Variable expenses', blurb: 'Day-to-day spending you control', color: 'var(--series-3)' },
  { id: 'savings', title: 'Savings', blurb: 'Money you pay yourself first', color: 'var(--series-6)' },
];

export function BudgetPage() {
  const data = useData();
  const today = getToday();
  const [period, setPeriod] = usePeriod();
  const { setAllocation, copyBudget } = useStore.getState();
  const s = useMemo(() => summarize(data, period, today), [data, period, today]);
  const budget = resolveBudget(data, period);
  const [editing, setEditing] = useState<Category | 'new-fixed' | 'new-variable' | 'new-savings' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const prev = shiftPeriod(period, -1);
  const hasPrev = !!data.budgets[prev];


  return (
    <>
      <PageHeader title="Monthly budget" sub="Give every rand a job before the month starts.">
        <PeriodNav value={period} onChange={setPeriod} startDay={data.settings.periodStartDay} />
        {hasPrev && <button className="btn" onClick={() => copyBudget(prev, period)}><Copy /> Copy {periodLabel(prev, true)}</button>}
      </PageHeader>

      {period === shiftPeriod(periodKeyFor(today, data.settings.periodStartDay), 1) && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="sage">You're planning <b>{periodLabel(period)}</b>, which starts on payday ({fmtDate(periodStart(period, data.settings.periodStartDay))}). Mark your salary and allowance as received when they're paid in.
            <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setPeriod(shiftPeriod(period, -1))}>View {periodLabel(shiftPeriod(period, -1))}</button></Banner>
        </div>
      )}
      {period === periodKeyFor(today, data.settings.periodStartDay) && s.daysLeft > 0 && s.daysLeft <= 5 && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="sage">Payday is {s.daysLeft === 1 ? 'tomorrow' : `in ${s.daysLeft} days`}. <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setPeriod(shiftPeriod(period, 1))}>Plan {periodLabel(shiftPeriod(period, 1))}</button></Banner>
        </div>
      )}
      {budget.inherited && (
        <div className="mb-16" style={{ marginBottom: 16 }}>
          <Banner tone="sage">{Object.keys(data.budgets).length ? <>This month isn't set up yet, so it's using your most recent budget. Any change you make saves it for <b>{periodLabel(period)}</b>.</> : <>Start by adding your income, then set an amount for each category.</>}</Banner>
        </div>
      )}

      <div className="grid g-main">
        <IncomeCard period={period} />

        <Card title="Allocation">
          <div className="stackbar" aria-label="How income is allocated">
            {s.incomeExpected > 0 && GROUPS.map((g) => <span key={g.id} style={{ width: `${Math.min(100, (s.planned[g.id] / Math.max(s.incomeExpected, s.plannedTotal)) * 100)}%`, background: g.color }} />)}
          </div>
          <div className="legend mt-8">
            {GROUPS.map((g) => <span key={g.id}><i className="stat-dot" style={{ background: g.color }} />{g.title.split(' ')[0]} {money(s.planned[g.id], { cents: false })}</span>)}
          </div>
          <div className="mt-16" style={{ display: 'grid', gap: 8 }}>
            <div className="row between"><span className="text-2">Total allocated</span><b className="num">{money(s.plannedTotal)}</b></div>
            <div className="row between"><span className="text-2">Income allocated</span><b className="num">{fmtPct(s.allocatedPct)}</b></div>
            <div className="row between"><span className="text-2">Total expenses planned</span><b className="num">{money(s.planned.fixed + s.planned.variable)}</b></div>
            <div className="row between"><span className="text-2" title="Income after fixed costs and savings">Available for discretionary spending</span><b className="num">{money(s.discretionary)}</b></div>
            <div className="row between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <b>{s.overAllocated ? 'Over-allocated by' : 'Still to allocate'}</b>
              <b className={`num ${s.overAllocated ? 'danger' : s.unallocated === 0 ? 'good' : ''}`} data-testid="unallocated">{money(Math.abs(s.unallocated))}</b>
            </div>
          </div>
          {s.overAllocated && <div className="mt-12"><Banner tone="danger">You've planned more than you expect to earn. Reduce some categories by {money(-s.unallocated)}.</Banner></div>}
          {!s.overAllocated && s.incomeExpected > 0 && s.unallocated === 0 && <div className="mt-12"><Banner tone="good">Every rand has a job. Nice.</Banner></div>}
        </Card>
      </div>

      {GROUPS.map((g) => {
        const rows = s.rows.filter((r) => r.category.group === g.id);
        return (
          <Card key={g.id} className="mt-16" title={<><span className="stat-dot" style={{ background: g.color }} />{g.title} <span className="muted small" style={{ fontWeight: 500 }}>· {money(s.planned[g.id], { cents: false })} planned</span></>}
            action={<button className="btn sm" onClick={() => setEditing(`new-${g.id}`)}><Plus /> Add category</button>}>
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>Category</th>
                    {g.id === 'fixed' && <th className="hide-sm">Due</th>}
                    <th className="r">Planned</th>
                    <th className="r">{g.id === 'savings' ? 'Saved' : 'Spent'}</th>
                    <th className="r hide-sm">Left</th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => <Row key={r.category.id} r={r} fixed={g.id === 'fixed'} onEdit={() => setEditing(r.category)} onDelete={() => setDeleting(r.category)} onPlan={(v) => setAllocation(period, r.category.id, v)} />)}
                  {rows.length === 0 && <tr><td colSpan={6} className="muted small">No categories yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted xs mt-8">{g.blurb}. {g.id === 'fixed' ? 'Add a due day to get debit order reminders.' : ''}</p>
          </Card>
        );
      })}

      <Card className="mt-16" title="Debit orders & bills this month">
        <BillList bills={s.bills} />
      </Card>

      {editing && <CategoryModal initial={typeof editing === 'string' ? undefined : editing} group={typeof editing === 'string' ? (editing.slice(4) as CategoryGroup) : editing.group} period={period} planned={typeof editing === 'string' ? 0 : budget.allocations[editing.id] || 0} onClose={() => setEditing(null)} />}
      {deleting && <DeleteCategory category={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function Row({ r, fixed, onEdit, onDelete, onPlan }: { r: CategoryRow; fixed: boolean; onEdit: () => void; onDelete: () => void; onPlan: (v: number) => void }) {
  return (
    <tr>
      <td>
        <button className="row" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', gap: 8, textAlign: 'left' }} onClick={onEdit}>
          <span className="stat-dot" style={{ background: r.category.color }} /><span style={{ fontWeight: 600 }}>{r.category.name}</span>
        </button>
        {r.status === 'over' && <span className="chip danger" style={{ marginLeft: 8 }}>Over</span>}
        {r.status === 'near' && <span className="chip warn" style={{ marginLeft: 8 }}>Near limit</span>}
      </td>
      {fixed && <td className="hide-sm muted small nowrap">{r.category.dueDay ? `${ordinal(r.category.dueDay)} · ${r.category.payMethod || ''}` : '—'}</td>}
      <td className="r"><MoneyInput className="inline-wrap" value={r.planned} onCommit={(v) => v !== r.planned && onPlan(v)} ariaLabel={`Planned for ${r.category.name}`} /></td>
      <td className="r">{money(r.actual)}</td>
      <td className={`r hide-sm ${r.remaining < 0 ? 'danger' : ''}`}>{money(r.remaining)}</td>
      <td className="r nowrap">
        <button className="btn ghost icon sm" aria-label={`Edit ${r.category.name}`} onClick={onEdit}><Pencil /></button>
        <button className="btn ghost icon sm" aria-label={`Delete ${r.category.name}`} onClick={onDelete}><Trash2 /></button>
      </td>
    </tr>
  );
}

function CategoryModal({ initial, group: g0, period, planned, onClose }: { initial?: Category; group: CategoryGroup; period: string; planned: number; onClose: () => void }) {
  const { addCategory, updateCategory, setAllocation, toast } = useStore.getState();
  const [name, setName] = useState(initial?.name || '');
  const [group, setGroup] = useState<CategoryGroup>(initial?.group || g0);
  const [color, setColor] = useState(initial?.color || PALETTE[0]);
  const [dueDay, setDueDay] = useState<number | ''>(initial?.dueDay || '');
  const [payMethod, setPayMethod] = useState<PaymentMethod>(initial?.payMethod || 'Debit order');
  const [amount, setAmount] = useState<number | ''>(planned || '');
  const [touched, setTouched] = useState(false);
  const save = () => {
    setTouched(true);
    if (!name.trim()) return;
    const p = { name: name.trim(), group, color, dueDay: group === 'fixed' && dueDay ? Number(dueDay) : undefined, payMethod: group === 'fixed' ? payMethod : undefined };
    if (initial) {
      updateCategory(initial.id, p);
      if ((amount || 0) !== planned) setAllocation(period, initial.id, Number(amount) || 0);
    } else addCategory(p, period, Number(amount) || 0);
    toast(initial ? 'Category updated' : `Added ${p.name}`);
    onClose();
  };
  return (
    <Modal title={initial ? 'Edit category' : 'New category'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name" className="full" error={touched && !name.trim() ? 'Give the category a name' : ''}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. School fees" /></Field>
        <Field label="Type">
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value as CategoryGroup)} disabled={initial?.role === 'groceries'}>
            <option value="fixed">Fixed expense</option><option value="variable">Variable expense</option><option value="savings">Savings</option>
          </select>
        </Field>
        <Field label={`Planned for ${periodLabel(period)}`}><MoneyInput value={amount} onChange={setAmount} ariaLabel="Planned amount" /></Field>
        {group === 'fixed' && (
          <>
            <Field label="Due day of month" help="For reminders"><select className="input" value={dueDay} onChange={(e) => setDueDay(e.target.value ? Number(e.target.value) : '')}><option value="">No due date</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></Field>
            <Field label="Paid by"><select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          </>
        )}
        <Field label="Colour" className="full">
          <div className="row wrap">{PALETTE.map((c) => <button type="button" key={c} aria-label={`Colour ${c}`} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />)}</div>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function DeleteCategory({ category, onClose }: { category: Category; onClose: () => void }) {
  const data = useData();
  const deleteCategory = useStore((s) => s.deleteCategory);
  const count = data.transactions.filter((t) => t.categoryId === category.id).length;
  const others = data.categories.filter((c) => c.id !== category.id);
  const [moveTo, setMoveTo] = useState(others.find((c) => c.id === 'misc')?.id || others[0]?.id || '');
  const [mode, setMode] = useState<'move' | 'delete'>('move');
  if (category.role === 'groceries')
    return <Modal title="Can't delete Groceries" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>OK</button>}><p className="text-2">The grocery budget, meal planner and shopping list depend on this category. You can rename it or set its amount to R0 instead.</p></Modal>;
  return (
    <Confirm title={`Delete “${category.name}”?`} onClose={onClose} onConfirm={() => deleteCategory(category.id, mode === 'move' ? moveTo : undefined)}
      message={count ? `${count} transaction${count === 1 ? ' uses' : 's use'} this category.` : 'It will be removed from every month. You can undo straight after.'}>
      {count > 0 && (
        <div className="stack mt-12" style={{ gap: 10 }}>
          <label className="check"><input type="radio" checked={mode === 'move'} onChange={() => setMode('move')} /> Move them to
            <select className="input sm" style={{ width: 'auto' }} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>{others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="check"><input type="radio" checked={mode === 'delete'} onChange={() => setMode('delete')} /> Delete the transactions too</label>
        </div>
      )}
    </Confirm>
  );
}
