import { useRef, useState } from 'react';
import { Camera, ClipboardPaste } from 'lucide-react';
import { Banner, Field, Modal, MoneyInput, NumberInput } from './ui';
import { DateInput } from './DateInput';
import { NEW_PRODUCT, ProductForm, ProductSelect } from './FoodForms';
import { getToday, useData, useStore } from '../data/store';
import { guessStore, parseReceiptText, receiptRows, type Receipt, type ReceiptRow } from '../domain/receipt';
import { groceryCategory } from '../domain/budget';
import { money } from '../lib/format';
import type { Product } from '../domain/types';

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

/** Ask Claude to read the slip (available inside claude.ai). Returns null when that isn't possible here. */
async function readWithClaude(image: Blob, products: Product[]): Promise<Receipt | null> {
  const claude = (window as any).claude;
  if (!claude?.use) return null;
  const sample = await claude.use('sample');
  if (!sample) return null;
  const limits = await sample.limits().catch(() => null);
  if (!limits?.images) return null;
  const list = products.map((p) => `${p.id}: ${p.name}`).join('\n');
  const prompt = `Read this photo of a South African supermarket till slip.
Return only JSON in this shape:
{"store": string|null, "date": "YYYY-MM-DD"|null, "total": number|null,
 "items": [{"name": string, "price": number, "quantity": number, "weightKg": number|null, "productId": string|null}]}
Rules:
- "price" is the amount charged for that line (after any line discount), in rand, as a number.
- "quantity" is how many units (1 if not shown). For weighed items set "weightKg" and quantity 1.
- Write "name" as a plain product name (expand abbreviations, e.g. "CLVR FC MLK 2L" → "Clover full cream milk 2L").
- "productId": the best match from this list, or null if nothing fits:
${list}
- Leave out totals, VAT, change, card/cash lines, loyalty and savings summaries, bag levies.
- "total" is the amount paid. Dates on SA slips are usually DD/MM/YYYY.`;
  return (await sample.json(prompt, { images: [image], modelTier: 'default', cache: false })) as Receipt;
}

export function ReceiptScan({ onClose }: { onClose: () => void }) {
  const data = useData();
  const saveReceipt = useStore((s) => s.saveReceipt);
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [storeId, setStoreId] = useState(data.stores[0]?.id || '');
  const [date, setDate] = useState<string | undefined>(getToday());
  const [total, setTotal] = useState<number | ''>('');
  const [record, setRecord] = useState(true);
  const [newFor, setNewFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyReceipt = (r: Receipt, rawText = '') => {
    const store = (r.store && guessStore(r.store, data.stores)) || guessStore(rawText, data.stores);
    if (store) setStoreId(store.id);
    if (r.date) setDate(r.date);
    if (r.total) setTotal(r.total);
    const rs = receiptRows(r, data.products);
    setRows(rs);
    const gc = groceryCategory(data);
    // Don't double-count a shop that's already logged.
    const sid = store?.id || storeId;
    if (r.total && data.transactions.some((t) => t.categoryId === gc?.id && t.date === (r.date || date) && t.storeId === sid && Math.abs(t.amount - r.total!) < 1)) setRecord(false);
    setStage('review');
    if (!rs.length) setError('No items found. Try a clearer, straight-on photo, or paste the text.');
  };

  const readPhoto = async (file: File) => {
    setError('');
    setStage('reading');
    try {
      setStatus('Reading your slip…');
      const img = await shrink(file);
      const viaClaude = await readWithClaude(img, data.products).catch((e) => {
        if (e?.code && e.code !== 'not_granted') console.warn(e);
        return null;
      });
      if (viaClaude) return applyReceipt(viaClaude);
      setStatus('Reading the text in your photo…');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, { logger: (m: { status: string; progress: number }) => setStatus(`${m.status} ${Math.round((m.progress || 0) * 100)}%`) });
      const { data: res } = await worker.recognize(img);
      await worker.terminate();
      applyReceipt(parseReceiptText(res.text), res.text);
    } catch {
      setStage('pick');
      setError('Couldn’t read that photo here. Try again with better light, or paste the slip’s text instead.');
    }
  };

  const chosen = rows.filter((r) => r.include && r.productId && r.price > 0);
  const upd = (i: number, p: Partial<ReceiptRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <Modal wide title="Scan a till slip" sub="Prices from your slip keep your shopping list costs accurate — no typing." onClose={onClose}
      footer={stage === 'review' ? <>
        <button className="btn left" onClick={() => { setStage('pick'); setRows([]); }}>Start over</button>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!chosen.length && !(record && Number(total) > 0)} onClick={() => {
          saveReceipt({ storeId, date: date || getToday(), total: Number(total) || undefined, rows: chosen, recordExpense: record });
          onClose();
        }}>Save {chosen.length} price{chosen.length === 1 ? '' : 's'}</button>
      </> : undefined}>
      {stage === 'pick' && (
        <div className="stack">
          {error && <Banner tone="warn">{error}</Banner>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0])} />
          <button className="dropzone" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
            <Camera size={30} /><div className="mt-8"><b>Take or choose a photo of your slip</b></div>
            <div className="small muted">Lay it flat, in good light, with the whole slip in view.</div>
          </button>
          <details>
            <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}><ClipboardPaste size={14} style={{ verticalAlign: -2 }} /> Or paste the text (e.g. from an e-receipt)</summary>
            <textarea className="input mt-8" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'CLOVER LOW FAT MILK 2L   34.99\nBANANAS\n1.234 kg @ 21.99/kg   27.14\nTOTAL   62.13'} />
            <button className="btn mt-8" disabled={!paste.trim()} onClick={() => applyReceipt(parseReceiptText(paste), paste)}>Read text</button>
          </details>
        </div>
      )}
      {stage === 'reading' && <div className="empty"><div className="bar thin" style={{ maxWidth: 260, margin: '0 auto 12px' }}><span style={{ width: '60%' }} /></div><b>{status}</b></div>}
      {stage === 'review' && (
        <div className="stack">
          {error && <Banner tone="warn">{error}</Banner>}
          <div className="form-grid">
            <Field label="Store"><select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Slip store">{data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Date"><DateInput value={date} onChange={setDate} required /></Field>
          </div>
          <div className="list">
            {rows.map((r, i) => (
              <div key={i} className="receipt-row">
                <input type="checkbox" checked={r.include} onChange={(e) => upd(i, { include: e.target.checked })} aria-label={`Use ${r.name}`} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="xs muted" style={{ marginBottom: 4 }}>{r.name}{r.note ? ` · ${r.note}` : ''}</div>
                  <ProductSelect className="input sm" value={r.productId} allowEmpty="— skip this item —" allowNew onChange={(v) => (v === NEW_PRODUCT ? setNewFor(i) : upd(i, { productId: v, include: !!v }))} />
                </div>
                <div style={{ width: 84, flexShrink: 0 }}><div className="xs muted" style={{ marginBottom: 4 }}>Price</div><NumberInput className="input sm" step="0.01" min={0} value={r.price} onChange={(n) => upd(i, { price: n })} ariaLabel={`Price for ${r.name}`} /></div>
                <div style={{ width: 92, flexShrink: 0 }}><div className="xs muted" style={{ marginBottom: 4 }}>Per (g)</div><NumberInput className="input sm" min={1} value={r.packSize} onChange={(n) => upd(i, { packSize: n })} ariaLabel={`Pack size for ${r.name}`} /></div>
              </div>
            ))}
          </div>
          <div className="card flat" style={{ background: 'var(--surface-2)', padding: 14 }}>
            <div className="row wrap" style={{ gap: 12 }}>
              <div style={{ width: 150 }}><div className="xs muted" style={{ marginBottom: 4 }}>Slip total</div><MoneyInput value={total} onChange={setTotal} ariaLabel="Slip total" /></div>
              <label className="check grow"><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} /> Also add {Number(total) > 0 ? money(Number(total)) : 'this shop'} to my grocery spending</label>
            </div>
          </div>
        </div>
      )}
      {newFor !== null && (
        <ProductForm initial={{ id: '', name: rows[newFor].name.replace(/\s+\d+\s*(g|kg|ml|l)\b/i, '').toLowerCase().replace(/^./, (c) => c.toUpperCase()), category: 'Other', packSize: rows[newFor].packSize, tags: [] } as Product}
          onClose={() => setNewFor(null)} onSaved={(id) => upd(newFor, { productId: id, include: true })} />
      )}
    </Modal>
  );
}
