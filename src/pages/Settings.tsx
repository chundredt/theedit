import { useRef, useState, useEffect } from 'react';
import { Download, Upload, RotateCcw, Sparkles, Database } from 'lucide-react';
import { Banner, Card, Confirm, Field, PageHeader, Seg } from '../components/ui';
import { getToday, useData, useStore } from '../data/store';
import { usePeriod } from '../lib/ui-state';
import { exportBackup, exportBudget, exportTransactions } from '../lib/exports';
import { ordinal } from '../lib/format';
import { periodLabel } from '../domain/period';

type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'randwise:theme';
export function applyTheme(t: Theme) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
export function savedTheme(): Theme {
  try {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
  } catch {
    return 'system';
  }
}

export function SettingsPage() {
  const data = useData();
  const { updateSettings, loadDemo, startFresh, importData, toast } = useStore.getState();
  const [period] = usePeriod();
  const s = data.settings;
  const [theme, setTheme] = useState<Theme>(savedTheme());
  const [confirm, setConfirm] = useState<'demo' | 'reset' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const onImport = async (file: File) => {
    try {
      importData(await file.text());
      toast('Backup restored');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read that file', { tone: 'error' });
    }
  };
  const bytes = new Blob([JSON.stringify(data)]).size;

  return (
    <>
      <PageHeader title="Settings & data" sub="Preferences, dietary needs, exports and backups." />
      <div className="grid g-2">
        <Card title="Profile & budget month">
          <div className="form-grid">
            <Field label="First name"><input className="input" defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && updateSettings({ name: e.target.value.trim() })} /></Field>
            <Field label="Salary paid on (budget month starts)" className="full" help={s.periodStartDay > 1 ? `Each budget month runs from payday on the ${ordinal(s.periodStartDay)} and is named after the month it ends in (25 Nov – 24 Dec is December).` : 'Calendar months.'}>
              <select className="input" value={s.periodStartDay} onChange={(e) => updateSettings({ periodStartDay: Number(e.target.value) })}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d === 1 ? '1st (calendar month)' : `${ordinal(d)} (payday cycle)`}</option>)}
              </select>
            </Field>
            <div className="field full"><span className="label-text">Privacy</span>
              <label className="check"><input type="checkbox" checked={s.hideAmountsOnOpen !== false} onChange={(e) => updateSettings({ hideAmountsOnOpen: e.target.checked })} /> Hide amounts each time I open the app</label>
              <span className="help">Amounts show as R ••• until you tap the eye icon at the top.</span>
            </div>
            <Field label="Appearance" className="full">
              <Seg value={theme} onChange={setTheme} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
            </Field>
          </div>
        </Card>

        <Card title="Food">
          <div className="form-grid">
            <Field label="Daily calorie target"><input className="input" type="number" min={1000} max={5000} step={50} defaultValue={s.kcalTarget} onBlur={(e) => updateSettings({ kcalTarget: Number(e.target.value) || 2000 })} aria-label="Daily calorie target" /></Field>
            <Field label="Daily protein target (g)" help="≈1.6 g per kg body weight if you train"><input className="input" type="number" min={30} max={300} defaultValue={s.proteinTarget} onBlur={(e) => updateSettings({ proteinTarget: Number(e.target.value) || 100 })} aria-label="Daily protein target" /></Field>
          </div>
        </Card>

        <Card title="Export">
          <div className="stack" style={{ gap: 10 }}>
            <button className="btn" onClick={() => exportTransactions(data, data.transactions, 'all-transactions')}><Download /> All transactions (CSV)</button>
            <button className="btn" onClick={() => exportBudget(data, period, getToday())}><Download /> {periodLabel(period)} budget vs actual (CSV)</button>
            <button className="btn" onClick={() => exportBackup(data)}><Database /> Full backup (JSON)</button>
            <p className="muted xs">CSV files open in Excel or Google Sheets. The JSON backup restores everything.</p>
          </div>
        </Card>

        <Card title="Backup & reset">
          <div className="stack" style={{ gap: 10 }}>
            <Banner>Your data is stored in this browser on this device ({(bytes / 1024).toFixed(0)} KB). Clearing browser data deletes it, so export a backup now and then.</Banner>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload /> Restore from backup</button>
            <button className="btn" onClick={() => setConfirm('demo')}><Sparkles /> Load sample data</button>
            <button className="btn danger" onClick={() => setConfirm('reset')}><RotateCcw /> Erase everything & start over</button>
          </div>
        </Card>
      </div>
      {confirm === 'demo' && <Confirm title="Replace your data with sample data?" confirmLabel="Load sample data" message="This replaces everything with three months of example data. Export a backup first if you want to keep your current data." onConfirm={loadDemo} onClose={() => setConfirm(null)} />}
      {confirm === 'reset' && <Confirm title="Erase everything?" confirmLabel="Erase" message="All budgets, transactions, goals, food log and habits will be deleted from this device." onConfirm={() => { startFresh(); useStore.getState().updateSettings({ onboarded: false }); }} onClose={() => setConfirm(null)} />}
    </>
  );
}
