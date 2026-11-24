import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Field, Modal, MoneyInput, NumberInput } from './ui';
import { DateInput } from './DateInput';
import { getToday, useData, useStore } from '../data/store';
import { lookupNutrition } from '../domain/ingredients';
import { PRODUCT_CATEGORIES, type DietTag, type ID, type PriceRecord, type Product, type ProductCategory } from '../domain/types';

export const NEW_PRODUCT = '__new';

export function ProductSelect({ value, onChange, allowEmpty, className = 'input', allowNew }: { value: ID; onChange: (v: ID) => void; allowEmpty?: string; className?: string; allowNew?: boolean }) {
  const products = useData().products;
  const groups = PRODUCT_CATEGORIES.map((c) => [c, products.filter((p) => p.category === c).sort((a, b) => a.name.localeCompare(b.name))] as const).filter(([, l]) => l.length);
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Product">
      {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
      {allowNew && <option value={NEW_PRODUCT}>＋ Add a new ingredient…</option>}
      {groups.map(([c, list]) => <optgroup key={c} label={c}>{list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
    </select>
  );
}

export function PriceForm({ initial, defaults, onClose }: { initial?: PriceRecord; defaults?: Partial<PriceRecord>; onClose: () => void }) {
  const data = useData();
  const { savePrice, deletePrice, toast } = useStore.getState();
  const seed = initial || defaults || {};
  const [productId, setProductId] = useState<ID>(seed.productId || data.products[0]?.id);
  const product = data.products.find((p) => p.id === productId);
  const [storeId, setStoreId] = useState<ID>(seed.storeId || data.stores[0]?.id);
  const [price, setPrice] = useState<number | ''>(initial?.price ?? '');
  const [packSize, setPackSize] = useState<number | ''>(seed.packSize || product?.packSize || '');
  const [isSpecial, setIsSpecial] = useState(seed.isSpecial ?? false);
  const [specialEnds, setSpecialEnds] = useState<string | undefined>(seed.specialEnds);
  const [wasPrice, setWasPrice] = useState<number | ''>(initial?.wasPrice ?? '');
  const [verifiedOn, setVerifiedOn] = useState<string | undefined>(initial ? getToday() : getToday());
  const [touched, setTouched] = useState(false);
  const ok = productId && storeId && price !== '' && price > 0 && packSize !== '' && packSize > 0 && verifiedOn;
  const save = () => {
    setTouched(true);
    if (!ok) return;
    savePrice({
      id: initial?.id, productId, storeId, price: price as number, packSize: packSize as number, isSpecial,
      specialEnds: isSpecial ? specialEnds : undefined, wasPrice: isSpecial && wasPrice ? (wasPrice as number) : undefined,
      verifiedOn: verifiedOn!, source: initial && initial.source !== 'sample' ? initial.source : 'manual', label: initial?.label,
    });
    toast('Price saved');
    onClose();
  };
  return (
    <Modal title={initial ? 'Update price' : 'Add a price'} sub="Saving marks it as verified on the date below." onClose={onClose}
      footer={<>
        {initial && <button className="btn danger left" onClick={() => { deletePrice(initial.id); onClose(); }}><Trash2 /> Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save price</button>
      </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Product" className="full"><ProductSelect value={productId} onChange={(v) => { setProductId(v); const p = data.products.find((x) => x.id === v); if (p && !initial) setPackSize(p.packSize); }} /></Field>
        <Field label="Store"><select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Store">{data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Price" error={touched && !(Number(price) > 0) ? 'Enter the shelf price' : ''}><MoneyInput value={price} onChange={setPrice} ariaLabel="Price" /></Field>
        <Field label="Pack size (g or ml)" help={product?.pieceGrams ? `${product.pieceLabel} ≈ ${product.pieceGrams} g` : 'Per kg prices: use 1000'}><input className="input" type="number" min={1} value={packSize} onChange={(e) => setPackSize(e.target.value ? Number(e.target.value) : '')} aria-label="Pack size" /></Field>
        <Field label="Price verified on"><DateInput value={verifiedOn} onChange={setVerifiedOn} required /></Field>
        <div className="full"><label className="check"><input type="checkbox" checked={isSpecial} onChange={(e) => setIsSpecial(e.target.checked)} /> This is a special / promotion</label></div>
        {isSpecial && (
          <>
            <Field label="Special ends"><DateInput value={specialEnds} onChange={setSpecialEnds} /></Field>
            <Field label="Normal price (optional)"><MoneyInput value={wasPrice} onChange={setWasPrice} ariaLabel="Was price" /></Field>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

const TAGS: DietTag[] = ['meat', 'pork', 'fish', 'dairy', 'egg', 'gluten'];

export function ProductForm({ initial, onClose, onSaved }: { initial?: Product; onClose: () => void; onSaved?: (id: ID) => void }) {
  const { saveProduct, deleteProduct } = useStore.getState();
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState<ProductCategory>(initial?.category || 'Pantry staples');
  const [packSize, setPackSize] = useState<number>(initial?.packSize || 500);
  const [n, setN] = useState(initial?.nutrition || { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [source, setSource] = useState(initial?.nutritionSource);
  const [looking, setLooking] = useState<'idle' | 'busy' | 'none'>('idle');
  const lookUp = async () => {
    setLooking('busy');
    const found = await lookupNutrition(name || initial?.name || '');
    if (found) { setN(found); setSource('database'); setLooking('idle'); } else setLooking('none');
  };
  const [tags, setTags] = useState<DietTag[]>(initial?.tags || []);
  const [pieceGrams, setPieceGrams] = useState<number | ''>(initial?.pieceGrams || '');
  const [pieceLabel, setPieceLabel] = useState(initial?.pieceLabel || '');
  const [touched, setTouched] = useState(false);
  const save = () => {
    setTouched(true);
    if (!name.trim() || !(packSize > 0)) return;
    const id = saveProduct({ id: initial?.id, name: name.trim(), category, packSize, nutrition: n, nutritionSource: source, tags, pieceGrams: pieceGrams || undefined, pieceLabel: pieceGrams ? pieceLabel || 'piece' : undefined });
    onSaved?.(id);
    onClose();
  };
  const num = (k: keyof typeof n) => (
    <Field label={k === 'kcal' ? 'kcal' : `${k[0].toUpperCase()}${k.slice(1)} (g)`}>
      <NumberInput min={0} step="0.1" value={n[k]} onChange={(v) => { setN({ ...n, [k]: v }); setSource('you'); }} ariaLabel={k} />
    </Field>
  );
  return (
    <Modal title={initial?.id ? 'Edit product' : 'New product'} onClose={onClose}
      footer={<>
        {initial?.id && <button className="btn danger left" onClick={() => { deleteProduct(initial.id); onClose(); }}><Trash2 /> Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button>
      </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name" className="full" error={touched && !name.trim() ? 'Required' : ''}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Greek yoghurt" /></Field>
        <Field label="Aisle"><select className="input" value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)}>{PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Usual pack size (g / ml)"><NumberInput min={1} value={packSize} onChange={setPackSize} ariaLabel="Usual pack size" /></Field>
        <div className="full row between wrap" style={{ gap: 8 }}>
          <span className="label-text">Nutrition per 100 g <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></span>
          <button type="button" className="btn sm" disabled={!name.trim() || looking === 'busy'} onClick={lookUp}>{looking === 'busy' ? 'Looking up…' : 'Look up nutrition'}</button>
        </div>
        {(source || looking === 'none') && <div className="full xs muted" style={{ marginTop: -6 }}>{looking === 'none' ? 'Nothing found online — type it from the label, or leave it.' : source === 'database' ? 'From the Open Food Facts food database — check against your label if you like.' : source === 'similar' ? 'Estimated from a similar ingredient.' : 'Entered by you.'}</div>}
        <div className="full" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>{num('kcal')}{num('protein')}{num('carbs')}{num('fat')}</div>
        <Field label="Sold by the piece? Grams each" help="e.g. egg = 50"><input className="input" type="number" min={0} value={pieceGrams} onChange={(e) => setPieceGrams(e.target.value ? Number(e.target.value) : '')} /></Field>
        <Field label="Piece name"><input className="input" value={pieceLabel} onChange={(e) => setPieceLabel(e.target.value)} placeholder="egg" disabled={!pieceGrams} /></Field>
        <div className="full field"><span className="label-text">Contains (for diet filters)</span>
          <div className="row wrap" style={{ gap: 6 }}>{TAGS.map((t) => <button type="button" key={t} className={`chip clickable ${tags.includes(t) ? 'on' : ''}`} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>)}</div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
