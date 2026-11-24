import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Info, CheckCircle2, AlertOctagon } from 'lucide-react';
import { money, parseAmount } from '../lib/format';
import { periodLabel, periodRangeLabel, shiftPeriod } from '../domain/period';
import type { BudgetStatus } from '../domain/budget';
import { useStore } from '../data/store';

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', icon }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{icon}{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, dot, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; dot?: string; tone?: 'good' | 'warn' | 'danger' }) {
  return (
    <div className="card stat">
      <div className="label">{dot && <span className="stat-dot" style={{ background: dot }} />}{label}</div>
      <div className={`value ${tone || ''}`}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Progress({ value, max, status, size }: { value: number; max: number; status?: BudgetStatus; size?: 'thin' | 'thick' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0;
  return (
    <div className={`bar ${status || ''} ${size || ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ pct, size = 72, stroke = 8, color = 'var(--sage)', children }: { pct: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function StatusChip({ status }: { status: BudgetStatus }) {
  if (status === 'over') return <span className="chip danger"><AlertOctagon /> Over</span>;
  if (status === 'near') return <span className="chip warn"><AlertTriangle /> Near limit</span>;
  if (status === 'ok') return <span className="chip good"><CheckCircle2 /> On track</span>;
  return null;
}

export function Banner({ tone = 'default', children, icon }: { tone?: 'default' | 'warn' | 'danger' | 'good' | 'sage'; children: ReactNode; icon?: ReactNode }) {
  const Ic = tone === 'warn' ? AlertTriangle : tone === 'danger' ? AlertOctagon : tone === 'good' ? CheckCircle2 : Info;
  return <div className={`banner ${tone}`}>{icon ?? <Ic />}<div>{children}</div></div>;
}

export function Modal({ title, onClose, children, footer, wide, sub }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; sub?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]), select, textarea');
    first?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" ref={ref}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <p className="muted small mt-8">{sub}</p>}
          </div>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, help, error, children, className = '' }: { label: ReactNode; help?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
      {error ? <span className="err">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
}

/** Text input that accepts "2000", "2 000,50", "R1,250" and reports a number. */
export function MoneyInput({ value, onChange, className = '', placeholder = '0.00', onCommit, autoFocus, ariaLabel, invalid }: {
  value: number | ''; onChange?: (n: number | '') => void; onCommit?: (n: number) => void; className?: string; placeholder?: string; autoFocus?: boolean; ariaLabel?: string; invalid?: boolean;
}) {
  const [text, setText] = useState(value === '' ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === '' || (onCommit && value === 0) ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const id = useId();
  return (
    <div className={`input-money ${className}`}>
      <span>R</span>
      <input
        id={id}
        className={`input ${invalid ? 'invalid' : ''}`}
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onFocus={() => (focused.current = true)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseAmount(e.target.value);
          onChange?.(e.target.value.trim() === '' ? '' : Number.isNaN(n) ? '' : n);
        }}
        onBlur={() => {
          focused.current = false;
          const n = parseAmount(text);
          if (onCommit) {
            const v = Number.isNaN(n) ? 0 : n;
            onCommit(v);
            setText(v ? String(v) : '');
          }
        }}
        onKeyDown={(e) => e.key === 'Enter' && onCommit && (e.target as HTMLInputElement).blur()}
      />
    </div>
  );
}

export function PeriodNav({ value, onChange, startDay }: { value: string; onChange: (k: string) => void; startDay: number }) {
  return (
    <div className="period-nav">
      <button className="btn ghost icon sm" onClick={() => onChange(shiftPeriod(value, -1))} aria-label="Previous month"><ChevronLeft /></button>
      <div className="lbl">
        {periodLabel(value)}
        {startDay > 1 && <small>{periodRangeLabel(value, startDay)}</small>}
      </div>
      <button className="btn ghost icon sm" onClick={() => onChange(shiftPeriod(value, 1))} aria-label="Next month"><ChevronRight /></button>
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export function Money({ v, cents = true, className = '' }: { v: number; cents?: boolean; className?: string }) {
  return <span className={`num ${className}`}>{money(v, { cents })}</span>;
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const restore = useStore((s) => s.restore);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>
          <span>{t.message}</span>
          {t.undo && (
            <button onClick={() => { restore(t.undo!); dismiss(t.id); }}>Undo</button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Delete', onConfirm, onClose, children }: { title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn danger solid" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
    </>}>
      <p className="text-2">{message}</p>
      {children}
    </Modal>
  );
}

/** Recharts tooltip in the app's style. */
export function ChartTip({ active, payload, label, labelFormat, valueFormat = (v: number) => money(v) }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="t">{labelFormat ? labelFormat(label, payload) : label ?? payload[0]?.name}</div>
      {payload.map((p: any) => (
        <div className="r" key={p.dataKey + p.name}>
          <span><i className="stat-dot" style={{ background: p.color || p.payload?.fill || p.fill }} />{p.name}</span>
          <b className="num">{valueFormat(p.value, p)}</b>
        </div>
      ))}
    </div>
  );
}

export function ProductAvatar({ name, color }: { name: string; color: string }) {
  return (
    <span className="avatar" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
    </span>
  );
}
