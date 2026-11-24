import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Field, Modal, MoneyInput } from './ui';
import { DateInput } from './DateInput';
import { getToday, useStore } from '../data/store';
import { PAYMENT_METHODS, type ID, type PaymentMethod, type Transaction } from '../domain/types';
import { groceryCategory } from '../domain/budget';

const GROUP_LABEL = { fixed: 'Fixed expenses', variable: 'Variable expenses', savings: 'Savings' } as const;

export function CategorySelect({ value, onChange, includeAll, className = 'input' }: { value: ID; onChange: (v: ID) => void; includeAll?: string; className?: string }) {
  const categories = useStore((s) => s.data.categories);
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Category">
      {includeAll && <option value="">{includeAll}</option>}
      {(['fixed', 'variable', 'savings'] as const).map((g) => (
        <optgroup key={g} label={GROUP_LABEL[g]}>
          {categories.filter((c) => c.group === g && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function TransactionForm({ initial, onClose, defaults }: { initial?: Transaction; onClose: () => void; defaults?: Partial<Transaction> }) {
  const data = useStore((s) => s.data);
  const { addTransaction, updateTransaction, deleteTransaction, toast } = useStore.getState();
  const grocery = groceryCategory(data);
  const [desc, setDesc] = useState(initial?.description ?? defaults?.description ?? '');
  const [amount, setAmount] = useState<number | ''>(initial?.amount ?? defaults?.amount ?? '');
  const [date, setDate] = useState<string | undefined>(initial?.date ?? defaults?.date ?? getToday());
  const [categoryId, setCategoryId] = useState<ID>(initial?.categoryId ?? defaults?.categoryId ?? grocery?.id ?? data.categories[0]?.id);
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? defaults?.method ?? 'Debit card');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [storeId, setStoreId] = useState<ID>(initial?.storeId ?? defaults?.storeId ?? '');
  const [goalId, setGoalId] = useState<ID>(initial?.goalId ?? defaults?.goalId ?? '');
  const [touched, setTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(!!initial || !!defaults?.categoryId);

  // Learn from history: typing a familiar description suggests its usual category & method.
  const history = useMemo(() => {
    const m = new Map<string, Transaction>();
    for (const t of data.transactions) if (!m.has(t.description.toLowerCase())) m.set(t.description.toLowerCase(), t);
    return m;
  }, [data.transactions]);

  const cat = data.categories.find((c) => c.id === categoryId);
  const goalsForCat = data.goals.filter((g) => g.categoryId === categoryId);
  const errors = {
    desc: !desc.trim() ? 'Add a short description' : '',
    amount: amount === '' || !(amount > 0) ? 'Enter an amount above R0' : '',
    date: !date ? 'Pick a date' : '',
  };
  const ok = !errors.desc && !errors.amount && !errors.date && categoryId;

  const save = () => {
    setTouched(true);
    if (!ok) return;
    const payload = {
      description: desc.trim(), amount: amount as number, date: date!, categoryId, method,
      notes: notes.trim() || undefined, storeId: cat?.role === 'groceries' && storeId ? storeId : undefined,
      goalId: cat?.group === 'savings' && goalId ? goalId : undefined,
    };
    if (initial) {
      updateTransaction(initial.id, payload);
      toast('Transaction updated');
    } else {
      addTransaction(payload);
      toast(`Added ${desc.trim()}`);
    }
    onClose();
  };

  return (
    <Modal
      title={initial ? 'Edit transaction' : 'Add expense'}
      onClose={onClose}
      footer={<>
        {initial && <button className="btn danger left" onClick={() => { deleteTransaction(initial.id); onClose(); }}><Trash2 /> Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>{initial ? 'Save changes' : 'Add expense'}</button>
      </>}
    >
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Description" className="full" error={touched ? errors.desc : ''}>
          <input className="input" list="tx-desc" value={desc} placeholder="e.g. Checkers weekly shop" onChange={(e) => {
            setDesc(e.target.value);
            const prev = history.get(e.target.value.trim().toLowerCase());
            if (prev && !categoryTouched) {
              setCategoryId(prev.categoryId);
              setMethod(prev.method);
              if (prev.storeId) setStoreId(prev.storeId);
            }
          }} />
          <datalist id="tx-desc">{[...history.values()].slice(0, 60).map((t) => <option key={t.id} value={t.description} />)}</datalist>
        </Field>
        <Field label="Amount" error={touched ? errors.amount : ''}>
          <MoneyInput value={amount} onChange={setAmount} ariaLabel="Amount" invalid={touched && !!errors.amount} />
        </Field>
        <Field label="Date" error={touched ? errors.date : ''}>
          <DateInput value={date} onChange={setDate} required ariaLabel="Date" />
        </Field>
        <Field label="Category">
          <CategorySelect value={categoryId} onChange={(v) => { setCategoryId(v); setCategoryTouched(true); }} />
        </Field>
        <Field label="Payment method">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-label="Payment method">
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        {cat?.role === 'groceries' && (
          <Field label="Store" help="Used for grocery spend per store">
            <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Store">
              <option value="">—</option>
              {data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        {cat?.group === 'savings' && goalsForCat.length > 0 && (
          <Field label="Savings goal" help="Counts towards this goal's progress">
            <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)} aria-label="Savings goal">
              <option value="">Not linked</option>
              {goalsForCat.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes (optional)" className="full">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 60 }} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
