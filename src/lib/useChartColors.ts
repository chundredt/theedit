import { useEffect, useState } from 'react';

/** Read theme tokens so Recharts (which needs concrete colours) follows light/dark mode. */
export function useCssVars<T extends string>(names: T[]): Record<T, string> {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<T, string>;
  };
  const [vals, setVals] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setVals(read());
    mq.addEventListener('change', on);
    const obs = new MutationObserver(on);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', on);
      obs.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return vals;
}
