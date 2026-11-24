import { addDays, dayName, mondayOf, toDate } from '../lib/format';
import type { ISODate } from '../domain/types';

/** A week of pill-shaped day buttons (Mon–Sun). `mark` adds a ★ under the day number. */
export function DayStrip({ value, onChange, today, mark }: { value: ISODate; onChange: (d: ISODate) => void; today: ISODate; mark?: (d: ISODate) => boolean }) {
  const start = mondayOf(value);
  return (
    <div className="day-strip" role="tablist" aria-label="Choose a day">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        return (
          <button key={d} role="tab" aria-selected={d === value} className={`day-pill ${d === value ? 'on' : ''} ${d === today ? 'today' : ''}`} onClick={() => onChange(d)}
            aria-label={`${dayName(d, false)} ${toDate(d).getDate()}${d === today ? ', today' : ''}`}>
            <span className="dot" aria-hidden>{mark?.(d) ? '★' : ''}</span>
            <span className="dn">{dayName(d)}</span>
            <span className="dd">{toDate(d).getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
