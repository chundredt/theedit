import { useMemo, useRef, useState } from 'react';
import { ReceiptScan } from '../components/ReceiptScan';
import { Camera, ClipboardPaste, ExternalLink, Link2, Pencil, Plus, Search, Tags, Trash2, Store as StoreIcon, Package } from 'lucide-react';
import { Banner, Card, Empty, Field, Modal, NumberInput, PageHeader, Seg } from '../components/ui';
import { DateInput } from '../components/DateInput';
import { PriceForm, ProductForm, ProductSelect } from '../components/FoodForms';
import { getToday, useData, useStore } from '../data/store';
import { activeSpecials, storePrices, STALE_DAYS } from '../domain/prices';
import { parseCatalogueText, type ParsedItem } from '../domain/flyer';
import { addDays, daysBetween, fmtDate, grams, money } from '../lib/format';
import type { ID, PriceRecord, Product, Store } from '../domain/types';
import { PALETTE } from '../data/seed';

type Tab = 'specials' | 'compare' | 'import' | 'manage';

export function PricesPage() {
  const data = useData();
  const [tab, setTab] = useState<Tab>('specials');
  const [editing, setEditing] = useState<{ initial?: PriceRecord; defaults?: Partial<PriceRecord> } | null>(null);
  const sampleCount = data.prices.filter((p) => p.source === 'sample').length;
  const [scanning, setScanning] = useState(false);
  return (
    <>
      <PageHeader title="Prices & specials" sub="Your own price book for Checkers, Food Lover's Market, Woolworths and any other store.">
        <button className="btn" onClick={() => setScanning(true)}><Camera /> Scan till slip</button>
        <button className="btn primary" onClick={() => setEditing({})}><Plus /> Add price</button>
      </PageHeader>
      <div className="row wrap between" style={{ marginBottom: 16 }}>
        <Seg value={tab} onChange={setTab} options={[{ value: 'specials', label: 'Specials' }, { value: 'compare', label: 'Compare prices' }, { value: 'import', label: 'Import catalogue' }, { value: 'manage', label: 'Products & stores' }]} />
      </div>
      <AutoPrices sampleCount={sampleCount} />
      {tab === 'specials' && <Specials onEdit={(initial) => setEditing({ initial })} onAdd={() => setEditing({ defaults: { isSpecial: true, specialEnds: addDays(getToday(), 7) } })} />}
      {tab === 'compare' && <Compare onEdit={(initial, defaults) => setEditing({ initial, defaults })} />}
      {tab === 'import' && <Import />}
      {tab === 'manage' && <Manage />}
      {scanning && <ReceiptScan onClose={() => setScanning(false)} />}
      {editing && <PriceForm initial={editing.initial} defaults={editing.defaults} onClose={() => setEditing(null)} />}
    </>
  );
}

function SourceChip({ p }: { p: PriceRecord }) {
  const stale = daysBetween(p.verifiedOn, getToday()) > STALE_DAYS;
  if (p.source === 'sample') return <span className="chip warn">Sample · verify</span>;
  if (stale) return <span className="chip warn">Verify · {fmtDate(p.verifiedOn)}</span>;
  return <span className="chip">Verified {fmtDate(p.verifiedOn)}</span>;
}

function Specials({ onEdit, onAdd }: { onEdit: (p: PriceRecord) => void; onAdd: () => void }) {
  const data = useData();
  const today = getToday();
  const [store, setStore] = useState('');
  const specials = activeSpecials(data, today).filter((s) => !store || s.store.id === store);
  const week = useMemoPlanProducts();
  return (
    <>
      <div className="row wrap" style={{ marginBottom: 16, gap: 6 }}>
        <button className={`chip clickable ${!store ? 'on' : ''}`} onClick={() => setStore('')}>All stores</button>
        {data.stores.map((s) => <button key={s.id} className={`chip clickable ${store === s.id ? 'on' : ''}`} onClick={() => setStore(s.id)}><span className="store-dot" style={{ background: s.color }} />{s.name}</button>)}
        <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={onAdd}><Plus /> Add special</button>
      </div>
      {specials.length === 0 ? (
        <Card><Empty icon={<Tags />} title="No active specials recorded" action={<button className="btn primary" onClick={onAdd}><Plus /> Add a special</button>}>Add specials by hand or import them from a catalogue. Expired specials disappear automatically.</Empty></Card>
      ) : (
        <div className="recipe-grid">
          {specials.map((s) => (
            <button key={s.record.id} className="card special-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onEdit(s.record)}>
              <div className="row between"><span className="row small" style={{ gap: 6, fontWeight: 600 }}><span className="store-dot" style={{ background: s.store.color }} />{s.store.name}</span>
                {s.savingPct ? <span className="chip good">Save {Math.round(s.savingPct)}%</span> : null}</div>
              <b style={{ fontSize: 15 }}>{s.product.name}</b>
              <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                <span className="price">{money(s.record.price)}</span>
                {s.saving ? <span className="was">{money(s.record.price + s.saving)}</span> : null}
              </div>
              <div className="muted xs">{s.record.label ? `${s.record.label} · ` : ''}{grams(s.record.packSize, s.product)} · {money((s.record.price / s.record.packSize) * 1000)}/kg</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {s.daysLeft !== undefined && <span className={`chip ${s.daysLeft <= 1 ? 'danger' : s.daysLeft <= 3 ? 'warn' : ''}`}>{s.daysLeft === 0 ? 'Ends today' : `Ends ${fmtDate(s.record.specialEnds)}`}</span>}
                {week.has(s.product.id) && <span className="chip sage">In this week's plan</span>}
                <SourceChip p={s.record} />
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function useMemoPlanProducts() {
  const data = useData();
  return useMemo(() => {
    const set = new Set<ID>();
    const plans = Object.values(data.mealPlans).filter((p) => p.week >= addDays(getToday(), -6));
    const rec = new Map(data.recipes.map((r) => [r.id, r]));
    for (const p of plans) for (const d of p.days) for (const s of Object.values(d)) rec.get(s!.recipeId)?.ingredients.forEach((i) => set.add(i.productId));
    return set;
  }, [data]);
}

function Compare({ onEdit }: { onEdit: (initial?: PriceRecord, defaults?: Partial<PriceRecord>) => void }) {
  const data = useData();
  const today = getToday();
  const [q, setQ] = useState('');
  const [onlyPlan, setOnlyPlan] = useState(false);
  const plan = useMemoPlanProducts();
  const rows = data.products
    .filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!onlyPlan || plan.has(p.id)))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return (
    <Card>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        </div>
        <label className="check small"><input type="checkbox" checked={onlyPlan} onChange={(e) => setOnlyPlan(e.target.checked)} /> Only this week's meal plan</label>
        <span className="muted xs" style={{ marginLeft: 'auto' }}>Compared per kg / litre so different pack sizes are fair. Click a price to update it.</span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Product</th>{data.stores.map((s) => <th key={s.id} className="r"><span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><span className="store-dot" style={{ background: s.color }} />{s.name}</span></th>)}<th>Best buy</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const sp = storePrices(data, p.id, today);
              const best = sp[0];
              return (
                <tr key={p.id}>
                  <td><b>{p.name}</b><div className="muted xs">{p.category}</div></td>
                  {data.stores.map((s) => {
                    const x = sp.find((y) => y.store.id === s.id);
                    const isBest = best && x && x.store.id === best.store.id && sp.length > 1;
                    return (
                      <td key={s.id} className="r" style={{ background: isBest ? 'var(--good-soft)' : undefined, cursor: 'pointer' }} onClick={() => onEdit(x?.record, x ? undefined : { productId: p.id, storeId: s.id, packSize: p.packSize })}>
                        {x ? (
                          <>
                            <b className="num">{money(x.record.price)}</b>{x.isSpecial && <span className="chip good" style={{ marginLeft: 6 }}>Special</span>}
                            <div className="xs muted">{grams(x.record.packSize)} · {money(x.perKg)}/kg</div>
                            <div className="xs muted">{x.adjusted ? 'estimate (auto-adjusted)' : x.record.source === 'receipt' ? `till slip ${fmtDate(x.record.verifiedOn)}` : `checked ${fmtDate(x.record.verifiedOn)}`}</div>
                          </>
                        ) : <span className="muted small">+ add</span>}
                      </td>
                    );
                  })}
                  <td>{best ? <span className="row small" style={{ gap: 6 }}><span className="store-dot" style={{ background: best.store.color }} />{best.store.name}</span> : <span className="muted small">No prices</span>}
                    {sp.length > 1 && <div className="muted xs">saves {money(sp[sp.length - 1].perKg - best.perKg)}/kg</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface Row extends ParsedItem { include: boolean; productId: ID; special: boolean }

function Import() {
  const data = useData();
  const { addPrices, saveCatalogue, toast } = useStore.getState();
  const today = getToday();
  const [mode, setMode] = useState<'paste' | 'photo' | 'link'>('paste');
  const [storeId, setStoreId] = useState(data.stores[0]?.id || '');
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [validTo, setValidTo] = useState<string | undefined>(addDays(today, 7));
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [ocr, setOcr] = useState<{ status: string; pct: number } | null>(null);
  const [newProductFor, setNewProductFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (t: string) => {
    const items = parseCatalogueText(t, data.products);
    setRows(items.map((i) => ({ ...i, include: !!i.matchId, productId: i.matchId || '', special: true })));
    if (!items.length) toast('No prices found. Each line needs a product name and a price like R24.99.', { tone: 'error' });
  };
  const runOcr = async (file: File) => {
    setOcr({ status: 'Loading text recognition…', pct: 0 });
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, { logger: (m: { status: string; progress: number }) => setOcr({ status: m.status, pct: Math.round((m.progress || 0) * 100) }) });
      const { data: res } = await worker.recognize(file);
      await worker.terminate();
      setText(res.text);
      setOcr(null);
      parse(res.text);
      setMode('paste');
      toast('Text extracted — check each row before saving');
    } catch (e) {
      setOcr(null);
      toast('Could not read the image here (the text engine downloads on first use and needs internet). Type or paste the specials instead.', { tone: 'error' });
      console.warn(e);
    }
  };
  const save = () => {
    const chosen = (rows || []).filter((r) => r.include && r.productId && r.price > 0);
    if (!chosen.length) return toast('Tick at least one row with a matched product', { tone: 'error' });
    addPrices(
      chosen.map((r) => ({
        productId: r.productId, storeId, price: r.price, packSize: r.packSize || data.products.find((p) => p.id === r.productId)!.packSize,
        isSpecial: r.special, specialEnds: r.special ? validTo : undefined, wasPrice: r.special ? r.wasPrice : undefined,
        verifiedOn: today, source: mode === 'photo' || ocr ? 'flyer' : 'catalogue', label: r.multiBuy ? `${r.multiBuy.qty} for ${money(r.multiBuy.total)}` : undefined,
      })),
      { storeId, title: title || `${data.stores.find((s) => s.id === storeId)?.name} specials`, url: url || undefined, validFrom: today, validTo, addedOn: today },
    );
    toast(`Saved ${chosen.length} price${chosen.length === 1 ? '' : 's'}`);
    setRows(null);
    setText('');
  };
  const upd = (i: number, p: Partial<Row>) => setRows((r) => r!.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="stack">
      <Card>
        <div className="form-grid">
          <Field label="Store"><select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Import store">{data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Specials valid until"><DateInput value={validTo} onChange={setValidTo} /></Field>
          <Field label="Catalogue name (optional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Month-end deals" /></Field>
          <Field label="Catalogue link (optional)"><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        </div>
        <div className="row wrap mt-16"><Seg value={mode} onChange={setMode} options={[{ value: 'paste', label: <span className="row" style={{ gap: 6 }}><ClipboardPaste size={14} />Paste text</span> }, { value: 'photo', label: <span className="row" style={{ gap: 6 }}><Camera size={14} />Flyer photo</span> }, { value: 'link', label: <span className="row" style={{ gap: 6 }}><Link2 size={14} />Save link only</span> }]} /></div>

        {mode === 'paste' && (
          <div className="mt-16">
            <textarea className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)} aria-label="Catalogue text"
              placeholder={'Copy the specials from the store website or a PDF catalogue and paste here, one product per line, e.g.\nChicken Breast Fillets per kg R89.99\nClover Milk 2L Was R36.99 Now R32.99\nAny 2 for R45 Tuna Chunks 170g'} />
            <div className="row mt-12"><button className="btn primary" disabled={!text.trim()} onClick={() => parse(text)}>Find prices</button><span className="muted xs">Nothing is saved until you review the results.</span></div>
          </div>
        )}
        {mode === 'photo' && (
          <div className="mt-16">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && runOcr(e.target.files[0])} />
            <div className="dropzone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) runOcr(f); }}>
              <Camera size={28} /><div className="mt-8"><b>Upload or photograph a flyer</b></div>
              <div className="small muted">Text is read in your browser — the image is not uploaded or stored. Works best on a clear, straight photo of one page.</div>
            </div>
            {ocr && <div className="mt-12 small">{ocr.status} {ocr.pct ? `${ocr.pct}%` : ''}<div className="bar thin mt-8"><span style={{ width: `${ocr.pct}%` }} /></div></div>}
            <p className="muted xs mt-8">PDF catalogue? Open it, select and copy the text, and use “Paste text”.</p>
          </div>
        )}
        {mode === 'link' && (
          <div className="mt-16 stack" style={{ gap: 10 }}>
            <Banner>Saving a link keeps the catalogue handy with its validity dates. TheEdit can't read store websites directly (they don't offer a public feed), so open the link and paste the prices you care about.</Banner>
            <div><button className="btn primary" disabled={!url.trim()} onClick={() => { saveCatalogue({ storeId, title: title || 'Catalogue', url: url.trim(), validFrom: today, validTo, addedOn: today, itemCount: 0 }); setUrl(''); setTitle(''); toast('Catalogue link saved'); }}>Save link</button></div>
          </div>
        )}
      </Card>

      {rows && (
        <Card title={`Review ${rows.length} item${rows.length === 1 ? '' : 's'}`} action={<button className="btn primary" onClick={save}>Save {rows.filter((r) => r.include && r.productId).length} prices</button>}>
          <p className="muted small" style={{ marginBottom: 10 }}>Match each line to a product in your price book (or create one). Unmatched lines are skipped.</p>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th></th><th>Found</th><th>Product</th><th className="r">Price</th><th className="r">Pack (g)</th><th>Special</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input type="checkbox" checked={r.include} onChange={(e) => upd(i, { include: e.target.checked })} aria-label={`Include ${r.name}`} /></td>
                    <td style={{ maxWidth: 260 }}><div className="small">{r.name}</div>{r.wasPrice && <div className="xs muted">was {money(r.wasPrice)}</div>}{r.multiBuy && <div className="xs muted">{r.multiBuy.qty} for {money(r.multiBuy.total)}</div>}</td>
                    <td style={{ minWidth: 200 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <ProductSelect className="input sm" value={r.productId} allowEmpty="— not matched —" onChange={(v) => upd(i, { productId: v, include: !!v })} />
                        <button className="btn sm icon" title="New product" onClick={() => setNewProductFor(i)}><Plus /></button>
                      </div>
                      {r.productId && r.confidence < 0.6 && r.productId === r.matchId && <div className="xs warn">Check this match</div>}
                    </td>
                    <td className="r"><NumberInput className="input sm" style={{ width: 90, textAlign: 'right' }} step="0.01" min={0} value={r.price} onChange={(n) => upd(i, { price: n })} ariaLabel="Price" /></td>
                    <td className="r"><input className="input sm" style={{ width: 80, textAlign: 'right' }} type="number" value={r.packSize || ''} onChange={(e) => upd(i, { packSize: Number(e.target.value) || undefined })} /></td>
                    <td><input type="checkbox" checked={r.special} onChange={(e) => upd(i, { special: e.target.checked })} aria-label="Special" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {newProductFor !== null && rows && (
        <ProductForm initial={{ id: '', name: rows[newProductFor].name, category: 'Other', packSize: rows[newProductFor].packSize || 500, tags: [] } as Product} onClose={() => setNewProductFor(null)} onSaved={(id) => upd(newProductFor, { productId: id, include: true })} />
      )}
      <Catalogues />
    </div>
  );
}

function Catalogues() {
  const data = useData();
  const del = useStore((s) => s.deleteCatalogue);
  const today = getToday();
  if (!data.catalogues.length) return null;
  return (
    <Card title="Saved catalogues">
      <div className="list">
        {data.catalogues.map((c) => {
          const s = data.stores.find((x) => x.id === c.storeId);
          const expired = c.validTo && c.validTo < today;
          return (
            <div className="list-item" key={c.id}>
              <span className="store-dot" style={{ background: s?.color, width: 12, height: 12 }} />
              <div className="grow"><div className="title">{c.title}</div><div className="meta">{s?.name} · {c.validFrom ? `${fmtDate(c.validFrom)} – ` : ''}{fmtDate(c.validTo)} · {c.itemCount} prices imported</div></div>
              {expired ? <span className="chip">Expired</span> : <span className="chip good">Current</span>}
              {c.url && <a className="btn sm icon ghost" href={c.url} target="_blank" rel="noreferrer noopener" aria-label="Open catalogue"><ExternalLink /></a>}
              <button className="btn sm icon ghost" onClick={() => del(c.id)} aria-label="Remove catalogue"><Trash2 /></button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Manage() {
  const data = useData();
  const [product, setProduct] = useState<Product | 'new' | null>(null);
  const [store, setStore] = useState<Store | 'new' | null>(null);
  const [q, setQ] = useState('');
  return (
    <div className="grid g-main">
      <Card title={`${data.products.length} products`} icon={<Package size={17} />} action={<button className="btn sm" onClick={() => setProduct('new')}><Plus /> Product</button>}>
        <input className="input" placeholder="Filter products" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        <div className="list">
          {data.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <button key={p.id} className="list-item" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer' }} onClick={() => setProduct(p)}>
              <div className="grow"><div className="title">{p.name}</div><div className="meta">{p.category} · {grams(p.packSize)} · {p.nutrition ? `${p.nutrition.kcal} kcal, ${p.nutrition.protein} g protein /100 g` : 'no nutrition'}</div></div>
              <span className="muted xs">{data.prices.filter((x) => x.productId === p.id).length} prices</span><Pencil size={15} className="muted" />
            </button>
          ))}
        </div>
      </Card>
      <Card title="Stores" icon={<StoreIcon size={17} />} action={<button className="btn sm" onClick={() => setStore('new')}><Plus /> Store</button>}>
        <div className="list">
          {data.stores.map((s) => (
            <div className="list-item" key={s.id}>
              <span className="store-dot" style={{ background: s.color, width: 12, height: 12 }} />
              <div className="grow"><div className="title">{s.name}</div><div className="meta">{data.prices.filter((p) => p.storeId === s.id).length} prices</div></div>
              <button className="btn ghost icon sm" onClick={() => setStore(s)} aria-label={`Edit ${s.name}`}><Pencil /></button>
            </div>
          ))}
        </div>
        <p className="muted xs mt-8">Add Pick n Pay, Shoprite, Spar or your local market to compare them too.</p>
      </Card>
      {product && <ProductForm initial={product === 'new' ? undefined : product} onClose={() => setProduct(null)} />}
      {store && <StoreForm initial={store === 'new' ? undefined : store} onClose={() => setStore(null)} />}
    </div>
  );
}

function StoreForm({ initial, onClose }: { initial?: Store; onClose: () => void }) {
  const { saveStore, deleteStore } = useStore.getState();
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || PALETTE[3]);
  const [website, setWebsite] = useState(initial?.website || '');
  return (
    <Modal title={initial ? 'Edit store' : 'Add store'} onClose={onClose} footer={<>
      {initial && <button className="btn danger left" onClick={() => { deleteStore(initial.id); onClose(); }}><Trash2 /> Delete</button>}
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!name.trim()} onClick={() => { saveStore({ id: initial?.id, name: name.trim(), color, website: website || undefined }); onClose(); }}>Save</button>
    </>}>
      <div className="form-grid">
        <Field label="Name" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pick n Pay" /></Field>
        <Field label="Specials page (optional)" className="full"><input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
        <Field label="Colour" className="full"><div className="row wrap">{PALETTE.map((c) => <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />)}</div></Field>
      </div>
    </Modal>
  );
}

/** Explains how prices keep themselves current, and what's been learned per store. */
function AutoPrices({ sampleCount }: { sampleCount: number }) {
  const data = useData();
  const learned = data.stores.map((s) => ({ s, f: data.storeFactors?.[s.id] })).filter((x) => x.f && x.f.shops > 0);
  const slips = data.prices.filter((p) => p.source === 'receipt').length;
  return (
    <div className="tile pastel bg-sky" style={{ marginBottom: 16 }}>
      <div className="eyebrow">Prices look after themselves</div>
      <p className="small mt-8" style={{ maxWidth: 720 }}>
        When you finish a shop, TheEdit compares what you paid with its estimate and adjusts that store's prices. Older prices also rise with food inflation ({data.settings.foodInflation ?? 5}% a year). Scan a till slip any time for exact prices.
      </p>
      <div className="row wrap mt-12" style={{ gap: 6 }}>
        {learned.length ? learned.map(({ s, f }) => (
          <span key={s.id} className="chip" style={{ background: 'rgba(255,255,255,0.7)', color: '#111' }}>
            <span className="store-dot" style={{ background: s.color }} />{s.name}: {f!.factor > 1.005 ? `+${Math.round((f!.factor - 1) * 100)}%` : f!.factor < 0.995 ? `−${Math.round((1 - f!.factor) * 100)}%` : 'on target'} · {f!.shops} shop{f!.shops === 1 ? '' : 's'}
          </span>
        )) : <span className="small" style={{ opacity: 0.7 }}>Nothing learned yet — finish your first shop from the shopping list.</span>}
        {slips > 0 && <span className="chip" style={{ background: 'rgba(255,255,255,0.7)', color: '#111' }}>📸 {slips} prices from till slips</span>}
        {sampleCount > 0 && <span className="chip" style={{ background: 'rgba(255,255,255,0.7)', color: '#111' }}>{sampleCount} starting estimates</span>}
      </div>
    </div>
  );
}
