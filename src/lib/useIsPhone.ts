import { useEffect, useState } from 'react';

/** True on phone-sized screens, so layouts can switch rather than squeeze. */
export function useIsPhone(maxWidth = 700): boolean {
  const q = `(max-width: ${maxWidth}px)`;
  const [is, setIs] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setIs(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return is;
}
