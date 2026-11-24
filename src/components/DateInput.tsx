import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { fmtDate } from '../lib/format';
import type { ISODate } from '../domain/types';

/** Parse "24/11/2026", "24-11-26", "2026-11-24" → ISO. */
export function parseDMY(s: string): ISODate | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[2], +m[1]);
  }
  return null;
}
function valid(y: number, mo: number, d: number): ISODate | null {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Always shows DD/MM/YYYY regardless of the browser locale; the calendar button opens the native picker. */
export function DateInput({ value, onChange, required, ariaLabel }: { value?: ISODate; onChange: (v: ISODate | undefined) => void; required?: boolean; ariaLabel?: string }) {
  const [text, setText] = useState(value ? fmtDate(value) : '');
  const [bad, setBad] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setText(value ? fmtDate(value) : '');
    setBad(false);
  }, [value]);
  const commit = () => {
    if (!text.trim()) {
      setBad(!!required);
      onChange(undefined);
      return;
    }
    const iso = parseDMY(text);
    setBad(!iso);
    if (iso) {
      onChange(iso);
      setText(fmtDate(iso));
    }
  };
  return (
    <div style={{ position: 'relative' }}>
      <input
        className={`input ${bad ? 'invalid' : ''}`}
        placeholder="DD/MM/YYYY"
        value={text}
        aria-label={ariaLabel}
        inputMode="numeric"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={{ paddingRight: 40 }}
      />
      <button type="button" className="btn ghost icon sm" aria-label="Open calendar" style={{ position: 'absolute', right: 4, top: 5 }}
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try { el.showPicker(); } catch { el.focus(); el.click(); }
        }}>
        <Calendar />
      </button>
      <input ref={picker} type="date" tabIndex={-1} aria-hidden value={value || ''} onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      {bad && <span className="err xs">Use DD/MM/YYYY</span>}
    </div>
  );
}
