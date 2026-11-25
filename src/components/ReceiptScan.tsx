import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Banner, Field, Modal, MoneyInput } from './ui';
import { DateInput } from './DateInput';
import { getToday, useData, useStore } from '../data/store';
import { parseReceiptText, type Receipt } from '../domain/receipt';
import { groceryCategory } from '../domain/budget';
import { money } from '../lib/format';

/** Shrink a photo before sending it to be read (keeps it fast and under size limits). */
async function shrink(file: File, max = 1800): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Ask Claude to read the slip (only available when opened inside claude.ai). */
async function readWithClaude(image: Blob): Promise<Receipt | null> {
  const claude = (window as any).claude;
  if (!claude?.use) return null;
  const sample = await claude.use('sample');
  if (!sample) return null;
  const limits = await sample.limits().catch(() => null);
  if (!limits?.images) return null;
  const prompt = `Read this photo of a South African till slip. Return only JSON: {"store": string|null, "date": "YYYY-MM-DD"|null, "total": number|null, "items": []}.
"total" is the amount paid in rand. Dates on SA slips are usually DD/MM/YYYY.`;
  return (await sample.json(prompt, { images: [image], modelTier: 'default', cache: false })) as Receipt;
}

/** Photo of a till slip → the total and date, saved as a grocery purchase. */
export function ReceiptScan({ onClose }: { onClose: () => void }) {
  const data = useData();
  const { addTransaction, toast } = useStore.getState();
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [date, setDate] = useState<string | undefined>(getToday());
  const [total, setTotal] = useState<number | ''>('');
  const [label, setLabel] = useState('Grocery shop');
  const fileRef = useRef<HTMLInputElement>(null);
  const gc = groceryCategory(data);

  const apply = (r: Receipt) => {
    if (r.date) setDate(r.date);
    if (r.total) setTotal(r.total);
    if (r.store) setLabel(`${r.store.replace(/\b\w/g, (c) => c.toUpperCase())} shop`);
    if (!r.total) setError('Couldn’t find the total — type it in.');
    setStage('review');
  };

  const readPhoto = async (file: File) => {
    setError('');
    setStage('reading');
    try {
      setStatus('Reading your slip…');
      const img = await shrink(file);
      const viaClaude = await readWithClaude(img).catch(() => null);
      if (viaClaude) return apply(viaClaude);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, { logger: (m: { status: string; progress: number }) => setStatus(`Reading… ${Math.round((m.progress || 0) * 100)}%`) });
      const { data: res } = await worker.recognize(img);
      await worker.terminate();
      apply(parseReceiptText(res.text));
    } catch {
      setError('Couldn’t read that photo. Type the total instead.');
      setStage('review');
    }
  };

  const save = () => {
    if (!(Number(total) > 0) || !gc) return;
    addTransaction({ date: date || getToday(), description: label.trim() || 'Grocery shop', amount: Number(total), categoryId: gc.id, method: 'Debit card' });
    toast(`${money(Number(total))} added to groceries`);
    onClose();
  };

  return (
    <Modal title="Till slip" sub="Snap it and the total goes into your grocery spending." onClose={onClose}
      footer={stage === 'review' ? <><button className="btn left" onClick={() => setStage('pick')}>Retake</button><button className="btn primary" disabled={!(Number(total) > 0)} onClick={save}>Add to groceries</button></> : undefined}>
      {stage === 'pick' && (
        <div className="stack">
          {error && <Banner tone="warn">{error}</Banner>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0])} />
          <button className="dropzone" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
            <Camera size={30} /><div className="mt-8"><b>Take or choose a photo of your slip</b></div>
            <div className="small muted">Flat, in good light, with the total in view.</div>
          </button>
          <button className="btn" onClick={() => setStage('review')}>Type it instead</button>
        </div>
      )}
      {stage === 'reading' && <div className="empty"><div className="bar thin" style={{ maxWidth: 260, margin: '0 auto 12px' }}><span style={{ width: '60%' }} /></div><b>{status}</b></div>}
      {stage === 'review' && (
        <div className="stack">
          {error && <Banner tone="warn">{error}</Banner>}
          <div className="form-grid">
            <Field label="Total"><MoneyInput value={total} onChange={setTotal} ariaLabel="Slip total" /></Field>
            <Field label="Date"><DateInput value={date} onChange={setDate} required /></Field>
            <Field label="Description" className="full"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
