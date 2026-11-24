import { useState } from 'react';
import { Sparkles, PenLine } from 'lucide-react';
import { Field, MoneyInput } from './ui';
import { useStore } from '../data/store';
import { ordinal } from '../lib/format';

/** First run: explore with demo data, or set up your own month in three fields. */
export function Onboarding() {
  const { loadDemo, startFresh } = useStore.getState();
  const [step, setStep] = useState<'choose' | 'setup'>('choose');
  const [income, setIncome] = useState<number | ''>('');
  const [grocery, setGrocery] = useState<number | ''>(2000);
  const [startDay, setStartDay] = useState(1);
  const [name, setName] = useState('');

  return (
    <div className="overlay">
      <div className="modal onboard" role="dialog" aria-modal="true" aria-label="Welcome">
        <div className="modal-head">
          <div>
            <h2>Welcome to RandWise</h2>
            <p className="muted small mt-8">Your budget, groceries, meals and savings in one calm place. Everything is saved on this device.</p>
          </div>
        </div>
        <div className="modal-body">
          {step === 'choose' ? (
            <div className="stack">
              <button className="choice" onClick={() => setStep('setup')}>
                <span className="ic"><PenLine /></span>
                <span><b>Set up my own budget</b><br /><span className="muted small">Enter your take-home pay and grocery budget. Default South African categories are ready to fill in.</span></span>
              </button>
              <button className="choice" onClick={loadDemo}>
                <span className="ic"><Sparkles /></span>
                <span><b>Explore with sample data</b><br /><span className="muted small">Three months of example income, debit orders, groceries, a meal plan and savings goals. You can reset it any time in Settings.</span></span>
              </button>
            </div>
          ) : (
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); startFresh({ income: Number(income) || 0, grocery: Number(grocery) || 0, startDay, name }); }}>
              <Field label="Your first name (optional)" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Monthly take-home income" help="After tax, UIF and deductions"><MoneyInput value={income} onChange={setIncome} ariaLabel="Monthly income" /></Field>
              <Field label="Monthly grocery budget"><MoneyInput value={grocery} onChange={setGrocery} ariaLabel="Grocery budget" /></Field>
              <Field label="My budget month starts on" className="full" help="Paid on the 25th? Choose 25 so your budget runs payday to payday.">
                <select className="input" value={startDay} onChange={(e) => setStartDay(Number(e.target.value))}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d === 1 ? '1st (calendar month)' : `${ordinal(d)} of the month`}</option>)}
                </select>
              </Field>
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
