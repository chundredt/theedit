import { useMemo, useState } from 'react';
import { Clock, Pencil, Plus, Trash2, Users, ImagePlus, X, Copy } from 'lucide-react';
import { Banner, Field, Modal, NumberInput } from './ui';
import { ProductForm } from './FoodForms';
import { IngredientPicker, useQuickProduct } from './IngredientPicker';
import { parseIngredientText } from '../domain/ingredients';
import { getToday, useData, useStore } from '../data/store';
import { dietConflicts, recipeStats, type RecipeStats } from '../domain/recipes';
import { MEAL_TYPES, type Ingredient, type MealType, type Recipe } from '../domain/types';
import { grams, money } from '../lib/format';

const HUES = ['#e8efe4', '#f3e7dc', '#e4ebf3', '#efe6f1', '#f4ecd6', '#e0efee', '#f3e3e7'];
function hue(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function RecipeImage({ recipe, height = 128, badge }: { recipe: Recipe; height?: number; badge?: string }) {
  return (
    <div className="recipe-img" style={{ height, background: recipe.image ? `url("${recipe.image}") center/cover` : hue(recipe.id) }}>
      {!recipe.image && <span aria-hidden>{recipe.emoji}</span>}
      {badge && <span className="chip">{badge}</span>}
    </div>
  );
}

export function Macros({ s }: { s: Pick<RecipeStats, 'kcal' | 'protein' | 'carbs' | 'fat'> }) {
  return (
    <div className="macros">
      <div><b>{Math.round(s.kcal)}</b><span>kcal</span></div>
      <div><b>{Math.round(s.protein)}g</b><span>protein</span></div>
      <div><b>{Math.round(s.carbs)}g</b><span>carbs</span></div>
      <div><b>{Math.round(s.fat)}g</b><span>fat</span></div>
    </div>
  );
}

export function RecipeCard({ recipe, stats, onClick, extra }: { recipe: Recipe; stats: RecipeStats; onClick: () => void; extra?: React.ReactNode }) {
  return (
    <button className="card recipe-card" onClick={onClick}>
      <RecipeImage recipe={recipe} badge={stats.costPerServing > 0 ? `${money(stats.costPerServing)} / serving` : undefined} />
      <div className="recipe-body">
        <h3>{recipe.name}</h3>
        <div className="row wrap muted xs" style={{ gap: 10 }}>
          <span className="row" style={{ gap: 4 }}><Clock size={13} />{recipe.prepMinutes} min</span>
          <span className="row" style={{ gap: 4 }}><Users size={13} />Serves {recipe.servings}</span>
          {stats.protein >= 30 && <span className="chip sage">High protein</span>}
        </div>
        {extra}
        <Macros s={stats} />
      </div>
    </button>
  );
}

export function RecipeDetail({ recipe, onClose, onEdit, onPlan, onCopy }: { recipe: Recipe; onClose: () => void; onEdit: () => void; onPlan?: () => void; onCopy?: () => void }) {
  const data = useData();
  const today = getToday();
  const stats = recipeStats(recipe, data, today);
  const products = new Map(data.products.map((p) => [p.id, p]));
  const conflicts = dietConflicts(recipe, data.settings, products);
  const deleteRecipe = useStore((s) => s.deleteRecipe);
  return (
    <Modal wide title={recipe.name} onClose={onClose} footer={<>
      <button className="btn danger left" onClick={() => { deleteRecipe(recipe.id); onClose(); }}><Trash2 /> Delete</button>
      {onCopy && <button className="btn" onClick={onCopy}><Copy /> Copy & edit</button>}
      <button className="btn" onClick={onEdit}><Pencil /> Edit</button>
      {onPlan && <button className="btn primary" onClick={onPlan}><Plus /> Add to meal plan</button>}
    </>}>
      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div style={{ borderRadius: 14, overflow: 'hidden' }}><RecipeImage recipe={recipe} height={180} /></div>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="chip"><Clock size={12} /> {recipe.prepMinutes} min</span>
            <span className="chip">Serves {recipe.servings}</span>
            <span className="chip sage">{money(stats.costPerServing)} per serving</span>
            {recipe.mealTypes.map((m) => <span className="chip" key={m}>{m}</span>)}
            {recipe.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
          </div>
          <div><div className="label-text" style={{ marginBottom: 6 }}>Per serving</div><Macros s={stats} /></div>
          {conflicts.length > 0 && <Banner tone="warn">Doesn't match your preferences: {conflicts.join(', ')}</Banner>}
          {stats.unpriced.length > 0 && <Banner>No price yet for {stats.unpriced.map((id) => products.get(id)?.name).join(', ')} — cost is understated.</Banner>}
        </div>
        <div className="stack">
          <div>
            <h3 style={{ marginBottom: 6 }}>Ingredients <span className="muted small">(for {recipe.servings})</span></h3>
            {recipe.ingredients.map((i) => {
              const p = products.get(i.productId);
              const inPantry = data.pantry.some((x) => x.productId === i.productId && (!x.expiry || x.expiry >= today));
              return (
                <div key={i.productId} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{p?.name || 'Removed product'} {inPantry && <span className="chip good" style={{ marginLeft: 4 }}>in pantry</span>}</span>
                  <span className="num muted">{i.grams} g{p?.pieceGrams ? ` · ${grams(i.grams, p)}` : ''}</span>
                </div>
              );
            })}
          </div>
          <div>
            <h3 style={{ marginBottom: 6 }}>Method</h3>
            <ol style={{ margin: 0, paddingLeft: 18 }} className="small text-2">{recipe.steps.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}</ol>
          </div>
        </div>
      </div>
    </Modal>
  );
}

async function resizeImage(file: File, max = 640): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RecipeForm({ initial, onClose, onSaved }: { initial?: Recipe; onClose: () => void; onSaved?: (id: string) => void }) {
  const data = useData();
  const today = getToday();
  const { saveRecipe, toast } = useStore.getState();
  const [name, setName] = useState(initial?.name || '');
  const [emoji, setEmoji] = useState(initial?.emoji || '🍲');
  const [image, setImage] = useState(initial?.image);
  const [mealTypes, setMealTypes] = useState<MealType[]>(initial?.mealTypes || ['dinner']);
  const [servings, setServings] = useState(initial?.servings || 2);
  const [prep, setPrep] = useState(initial?.prepMinutes || 20);
  const [ings, setIngs] = useState<Ingredient[]>(initial?.ingredients || [{ productId: '', grams: 100 }]);
  const [steps, setSteps] = useState((initial?.steps || []).join('\n'));
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [touched, setTouched] = useState(false);
  const [newFor, setNewFor] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState('');
  const quick = useQuickProduct();
  const addFromText = () => {
    const rows = parseIngredientText(pasteText, useStore.getState().data.products);
    const added = rows.map((r) => ({ productId: r.productId || quick(r.name), grams: r.grams }));
    setIngs([...ings.filter((x) => x.productId), ...added]);
    setPasteText('');
    const fresh = rows.filter((r) => !r.productId).length;
    toast(`Added ${rows.length} ingredient${rows.length === 1 ? '' : 's'}${fresh ? ` (${fresh} new — nutrition is filled in automatically)` : ''}. Check the grams.`);
  };
  const draft: Recipe = useMemo(() => ({ id: initial?.id || 'draft', name, emoji, image, mealTypes, servings, prepMinutes: prep, ingredients: ings.filter((i) => i.productId && i.grams > 0), steps: [], tags: [] }), [initial, name, emoji, image, mealTypes, servings, prep, ings]);
  const stats = recipeStats(draft, data, today);
  const valid = name.trim() && draft.ingredients.length > 0 && mealTypes.length > 0 && servings > 0;
  const save = () => {
    setTouched(true);
    if (!valid) return;
    const id = saveRecipe({ ...draft, id: initial?.id, name: name.trim(), steps: steps.split('\n').map((s) => s.trim()).filter(Boolean), tags: tags.split(',').map((t) => t.trim()).filter(Boolean), custom: initial?.custom ?? true });
    toast(initial ? 'Recipe updated' : 'Recipe added');
    onSaved?.(id);
    onClose();
  };
  return (
    <Modal wide title={initial?.id ? 'Edit recipe' : 'New recipe'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save recipe</button></>}>
      <div className="grid g-main" style={{ alignItems: 'start' }}>
        <div className="form-grid">
          <Field label="Recipe name" className="full" error={touched && !name.trim() ? 'Required' : ''}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken & chickpea bowl" /></Field>
          <Field label="Servings"><NumberInput min={1} max={20} value={servings} onChange={setServings} ariaLabel="Servings" /></Field>
          <Field label="Prep + cook time (min)"><NumberInput min={0} value={prep} onChange={setPrep} ariaLabel="Prep and cook time" /></Field>
          <div className="field full"><span className="label-text">Good for</span>
            <div className="row wrap" style={{ gap: 6 }}>{MEAL_TYPES.map((m) => <button type="button" key={m} className={`chip clickable ${mealTypes.includes(m) ? 'on' : ''}`} onClick={() => setMealTypes(mealTypes.includes(m) ? mealTypes.filter((x) => x !== m) : [...mealTypes, m])}>{m}</button>)}</div>
            {touched && !mealTypes.length && <span className="err">Pick at least one</span>}
          </div>
          <div className="field full"><span className="label-text">Ingredients (for the whole recipe)</span>
            <div className="quick-ings">
              <textarea className="input" rows={3} value={pasteText} onChange={(e) => setPasteText(e.target.value)} aria-label="Type or paste ingredients"
                placeholder={'Type or paste your ingredient list, e.g.\n500g chicken breast, 2 onions, 1 tin chopped tomatoes, 1 cup rice, 2 tbsp oil'} />
              <button type="button" className="btn sm primary" disabled={!pasteText.trim()} onClick={addFromText}><Plus /> Add these</button>
            </div>
            {ings.map((ing, i) => (
              <div className="row" key={i} style={{ gap: 6 }}>
                <IngredientPicker value={ing.productId} onChange={(v) => setIngs(ings.map((x, j) => (j === i ? { ...x, productId: v } : x)))} />
                <NumberInput className="input sm" style={{ width: 96, flexShrink: 0 }} min={0} value={ing.grams} ariaLabel="Grams" onChange={(n) => setIngs(ings.map((x, j) => (j === i ? { ...x, grams: n } : x)))} />
                <span className="muted xs">g</span>
                <button type="button" className="btn ghost icon sm" aria-label="Remove ingredient" onClick={() => setIngs(ings.filter((_, j) => j !== i))}><X /></button>
              </div>
            ))}
            <div><button type="button" className="btn sm" onClick={() => setIngs([...ings, { productId: '', grams: 100 }])}><Plus /> Ingredient</button></div>
            {touched && !draft.ingredients.length && <span className="err">Add at least one ingredient</span>}
            <span className="help">Not in the list? Choose “＋ Add a new ingredient…” at the top of the list.</span>
          </div>
          <Field label="Method (one step per line)" className="full"><textarea className="input" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
          <Field label="Tags (comma separated)" className="full"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Budget, Meal prep" /></Field>
        </div>
        <div className="stack">
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}><RecipeImage recipe={draft} height={150} /></div>
          <div className="row" style={{ gap: 6 }}>
            <label className="btn sm"><ImagePlus /> Photo<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await resizeImage(f)); }} /></label>
            {image && <button className="btn sm ghost" onClick={() => setImage(undefined)}>Remove</button>}
            <input className="input sm" style={{ width: 60, textAlign: 'center' }} value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} aria-label="Emoji" title="Emoji used when there's no photo" />
          </div>
          <div className="card flat tint">
            <div className="label-text" style={{ marginBottom: 6 }}>Per serving (calculated)</div>
            <Macros s={stats} />
            <div className="row between mt-12"><span className="text-2 small">Estimated cost</span><b>{money(stats.costPerServing)}</b></div>
            <div className="row between"><span className="text-2 small">Whole recipe</span><b>{money(stats.costPerServing * servings)}</b></div>
            <p className="muted xs mt-8">Uses the cheapest current price for each ingredient and nutrition per 100 g from your product list.</p>
          </div>
        </div>
      </div>
      {newFor !== null && <ProductForm onClose={() => setNewFor(null)} onSaved={(id) => setIngs(ings.map((x, k) => (k === newFor ? { ...x, productId: id } : x)))} />}
    </Modal>
  );
}
