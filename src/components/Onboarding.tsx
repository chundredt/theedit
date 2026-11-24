import { useState } from 'react';
import { Sparkles, PenLine } from 'lucide-react';
import { Field, MoneyInput } from './ui';
import { getToday, useStore } from '../data/store';
import { money, ordinal } from '../lib/format';
import { daysLeft, periodKeyFor, periodLabel, periodRangeLabel, shiftPeriod } from '../domain/period';

/** First run: explore with demo data, or set up your own pay cycle and income. */
export function Onboarding() {
  const { loadDemo, startFresh } = useStore.getState();
  const [step, setStep] = useState<'choose' | 'setup'>('choose');
  const [payDay, setPayDay] = useState(25);
  const [salary, setSalary] = useState<number | ''>('');
  const [commission, setCommission] = useState<number | ''>('');
  const [allowance, setAllowance] = useState<number | ''>('');
  const [grocery, setGrocery] = useState<number | ''>(2000);
  const [name, setName] = useState('');
  const total = (Number(salary) || 0) + (Number(commission) || 0) + (Number(allowance) || 0);
  // Within 5 days of payday, your first real budget is the one starting on payday.
  const current = periodKeyFor(getToday(), payDay);
  const key = daysLeft(current, payDay, getToday()) <= 5 ? shiftPeriod(current, 1) : current;

  return (
    <div className="overlay">
      <div className="modal onboard" role="dialog" aria-modal="true" aria-label="Welcome">
        <div className="modal-head">
          <div>
            <h2>Welcome to TheEdit</h2>
            <p className="muted small mt-8">Your budget, groceries, meals and savings in one calm place. Everything is saved on this device.</p>
          </div>
        </div>
        <div className="modal-body">
          {step === 'choose' ? (
            <div className="stack">
              <button className="choice" onClick={() => setStep('setup')}>
                <span className="ic"><PenLine /></span>
                <span><b>Set up my own budget</b><br /><span className="muted small">Tell us when you're paid and what comes in. Default South African categories are ready to fill in.</span></span>
              </button>
              <button className="choice" onClick={loadDemo}>
                <span className="ic"><Sparkles /></span>
                <span><b>Explore with sample data</b><br /><span className="muted small">Three months of example income, debit orders, groceries, a meal plan and savings goals. You can reset it any time in Settings.</span></span>
              </button>
            </div>
          ) : (
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); startFresh({ salary: Number(salary) || 0, commission: Number(commission) || 0, allowance: Number(allowance) || 0, grocery: Number(grocery) || 0, startDay: payDay, name }); }}>
              <Field label="Your first name (optional)" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="My salary is paid on" className="full" help={payDay > 1 ? `Your budget runs payday to payday. First budget: ${periodLabel(key)} (${periodRangeLabel(key, payDay)}).` : 'Your budget follows calendar months.'}>
                <select className="input" value={payDay} onChange={(e) => setPayDay(Number(e.target.value))} aria-label="Pay day">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{`the ${ordinal(d)} of every month`}</option>)}
                </select>
              </Field>
              <Field label="Salary (after tax)" help="What lands in your account"><MoneyInput value={salary} onChange={setSalary} ariaLabel="Salary" /></Field>
              <Field label="Allowance" help="Car, travel, cellphone… (optional)"><MoneyInput value={allowance} onChange={setAllowance} ariaLabel="Allowance" /></Field>
              <Field label="Commission — a cautious estimate" className="full" help="It changes every month, so budget with a figure you usually beat. Each month you'll enter what actually came in, and everything adjusts.">
                <MoneyInput value={commission} onChange={setCommission} ariaLabel="Commission estimate" />
              </Field>
              <Field label="Monthly grocery budget" className="full"><MoneyInput value={grocery} onChange={setGrocery} ariaLabel="Grocery budget" /></Field>
              {total > 0 && <p className="full small text-2">Expected income: <b>{money(total)}</b> a month.</p>}
              <div className="full row between mt-8">
                <button type="button" className="btn ghost" onClick={() => setStep('choose')}>Back</button>
                <button type="submit" className="btn primary">Start budgeting</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
