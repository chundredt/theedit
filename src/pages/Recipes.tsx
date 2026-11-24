import { useMemo, useState } from 'react';
import { ChefHat, Plus, Search } from 'lucide-react';
import { Empty, PageHeader } from '../components/ui';
import { RecipeCard, RecipeDetail, RecipeForm } from '../components/RecipeBits';
import { getToday, useData } from '../data/store';
import { dietConflicts, recipeStats } from '../domain/recipes';
import { MEAL_TYPES, type MealType, type Recipe } from '../domain/types';

type Sort = 'protein' | 'cost' | 'value' | 'time' | 'name';

export function RecipesPage() {
  const data = useData();
  const today = getToday();
  const [q, setQ] = useState('');
  const [meal, setMeal] = useState<MealType | ''>('');
  const [fitsDiet, setFitsDiet] = useState(true);
  const [pantryOnly, setPantryOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('value');
  const [open, setOpen] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const products = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const pantryIds = new Set(data.pantry.filter((p) => !p.expiry || p.expiry >= today).map((p) => p.productId));

  const list = useMemo(() => {
    const rows = data.recipes
      .filter((r) => (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))) && (!meal || r.mealTypes.includes(meal)))
      .filter((r) => !fitsDiet || dietConflicts(r, data.settings, products).length === 0)
      .map((r) => ({ r, s: recipeStats(r, data, today, products), pantry: r.ingredients.filter((i) => pantryIds.has(i.productId)).length }))
      .filter((x) => !pantryOnly || x.pantry >= Math.ceil(x.r.ingredients.length / 2));
    const by: Record<Sort, (a: (typeof rows)[0], b: (typeof rows)[0]) => number> = {
      protein: (a, b) => b.s.protein - a.s.protein,
      cost: (a, b) => a.s.costPerServing - b.s.costPerServing,
      value: (a, b) => b.s.proteinPerR10 - a.s.proteinPerR10,
      time: (a, b) => a.r.prepMinutes - b.r.prepMinutes,
      name: (a, b) => a.r.name.localeCompare(b.r.name),
    };
    return rows.sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, meal, fitsDiet, pantryOnly, sort, products, today]);

  return (
    <>
      <PageHeader title="Recipes" sub="Affordable, high-protein meals built from simple, shared ingredients.">
        <button className="btn primary" onClick={() => setEditing('new')}><Plus /> New recipe</button>
      </PageHeader>
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search recipes or tags" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
        </div>
        <select className="input" style={{ width: 'auto' }} value={meal} onChange={(e) => setMeal(e.target.value as MealType | '')} aria-label="Meal type">
          <option value="">All meals</option>{MEAL_TYPES.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="value">Most protein per rand</option><option value="protein">Highest protein</option><option value="cost">Cheapest per serving</option><option value="time">Quickest</option><option value="name">A–Z</option>
        </select>
        <label className="check small"><input type="checkbox" checked={fitsDiet} onChange={(e) => setFitsDiet(e.target.checked)} /> Fits my diet</label>
        <label className="check small"><input type="checkbox" checked={pantryOnly} onChange={(e) => setPantryOnly(e.target.checked)} /> Mostly from my pantry</label>
      </div>
      {list.length === 0 ? <div className="card"><Empty icon={<ChefHat />} title="No recipes match">Try clearing a filter, or create your own.</Empty></div> : (
        <div className="recipe-grid">
          {list.map(({ r, s, pantry }) => (
            <RecipeCard key={r.id} recipe={r} stats={s} onClick={() => setOpen(r)} extra={pantry > 0 ? <span className="xs good">{pantry} of {r.ingredients.length} ingredients in your pantry</span> : null} />
          ))}
        </div>
      )}
      {open && <RecipeDetail recipe={open} onClose={() => setOpen(null)} onEdit={() => { setEditing(open); setOpen(null); }} onPlan={() => { location.hash = 'meals'; }} />}
      {editing && <RecipeForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
