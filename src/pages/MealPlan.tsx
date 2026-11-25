import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, ListChecks, Minus, Plus, Sparkles, Trash2, Search } from 'lucide-react';
import { Banner, Card, Confirm, Modal, PageHeader, Progress } from '../components/ui';
import { RecipeDetail, RecipeForm, RecipeImage } from '../components/RecipeBits';
import { getToday, useData, useStore } from '../data/store';
import { useUI, go } from '../lib/ui-state';
import { autoFillWeek, emptyWeek, planTotals, buildShoppingList } from '../domain/shopping';
import { recipeStats, suggestRecipes } from '../domain/recipes';
import { groceryOverview } from '../domain/grocery';
import { periodKeyFor } from '../domain/period';
import { addDays, dayName, fmtDate, mondayOf, money } from '../lib/format';
import { MEAL_TYPES, type ID, type MealPlanWeek, type MealSlot, type MealType, type Recipe } from '../domain/types';

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export function MealPlanPage() {
  const data = useData();
  const today = getToday();
  const { week, setWeek } = useUI();
  const { setWeek: savePlan, setSlot } = useStore.getState();
  const plan: MealPlanWeek = data.mealPlans[week] || emptyWeek(week);
  const [picking, setPicking] = useState<{ day: number; meal: MealType } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const totals = useMemo(() => planTotals(data, plan, today), [data, plan, today]);
  const list = useMemo(() => buildShoppingList(data, plan, today, data.shopping[week]?.storeOverride), [data, plan, today, week]);
  const g = groceryOverview(data, periodKeyFor(today, data.settings.periodStartDay), today);
  const recipes = useMemo(() => new Map(data.recipes.map((r) => [r.id, r])), [data.recipes]);
  const filledDays = totals.days.filter((d) => d.meals > 0);
  const avgProtein = filledDays.length ? filledDays.reduce((s, d) => s + d.protein, 0) / filledDays.length : 0;
  const avgKcal = filledDays.length ? filledDays.reduce((s, d) => s + d.kcal, 0) / filledDays.length : 0;
  const filled = plan.days.reduce((n, d) => n + Object.keys(d).length, 0);
  const prevWeek = addDays(week, -7);
  const allowance = g.weeklyNow || g.weekly;

  const slotButton = (day: number, meal: MealType) => {
    const slot = plan.days[day]?.[meal];
    const r = slot && recipes.get(slot.recipeId);
    if (!slot || !r)
      return <button className="slot" onClick={() => setPicking({ day, meal })} aria-label={`Add ${meal} on ${dayName(addDays(week, day), false)}`}><Plus size={14} /> Add</button>;
    return (
      <button className="slot filled" onClick={() => setPicking({ day, meal })}>
        <span className="em">{r.emoji}</span>
        <span className="nm">{r.name}</span>
        <span className="mt">{slot.servings > 1 ? `×${slot.servings} · ` : ''}{Math.round(recipeStats(r, data, today).protein)} g protein</span>
      </button>
    );
  };

  return (
    <>
      <PageHeader title="Meal planner" sub="Plan the week, then let the shopping list build itself.">
        <div className="period-nav">
          <button className="btn ghost icon sm" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week"><ChevronLeft /></button>
          <div className="lbl">Week of {fmtDate(week).slice(0, 5)}<small>{week === mondayOf(today) ? 'This week' : `${fmtDate(week)} – ${fmtDate(addDays(week, 6))}`}</small></div>
          <button className="btn ghost icon sm" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week"><ChevronRight /></button>
        </div>
        {week !== mondayOf(today) && <button className="btn sm" onClick={() => setWeek(mondayOf(today))}>Today</button>}
      </PageHeader>

      <div className="grid g-4">
        <div className="card stat"><div className="label">Estimated food cost</div><div className="value">{money(totals.weekCost, { cents: false })}</div><div className="hint">Portions used this week</div></div>
        <div className="card stat"><div className="label">Shopping list</div><div className={`value ${allowance && list.total > allowance ? 'danger' : ''}`}>{money(list.total, { cents: false })}</div><div className="hint">{allowance ? `vs ${money(allowance, { cents: false })} weekly allowance` : 'Whole packs to buy'}</div></div>
        <div className="card stat"><div className="label">Avg protein / day</div><div className="value">{Math.round(avgProtein)} g</div><Progress value={avgProtein} max={data.settings.proteinTarget} size="thin" /><div className="hint">Target {data.settings.proteinTarget} g</div></div>
        <div className="card stat"><div className="label">Avg calories / day</div><div className="value">{Math.round(avgKcal)}</div><Progress value={avgKcal} max={data.settings.kcalTarget} size="thin" /><div className="hint">Target {data.settings.kcalTarget} kcal</div></div>
      </div>

      <div className="row wrap mt-16" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => savePlan(autoFillWeek(data, plan, today, data.settings.householdSize))} disabled={filled >= 28}><Sparkles /> Auto-fill empty slots</button>
        {data.mealPlans[prevWeek] && <button className="btn" onClick={() => savePlan({ week, days: data.mealPlans[prevWeek].days.map((d) => ({ ...d })) })}><Copy /> Copy last week</button>}
        <button className="btn" onClick={() => go('shopping')}><ListChecks /> Shopping list ({list.items.length})</button>
        {filled > 0 && <button className="btn ghost danger" onClick={() => setConfirmClear(true)}><Trash2 /> Clear week</button>}
      </div>
      {filled === 0 && <div style={{ marginBottom: 16 }}><Banner tone="sage">Tap a slot to choose a meal, or use <b>Auto-fill</b> — it picks cheap, high-protein recipes that share ingredients (less waste) and uses what's in your pantry first.</Banner></div>}

      <Card className="flat" >
        <div className="plan-grid">
          <div />
          {plan.days.map((_, i) => {
            const d = addDays(week, i);
            return <div key={i} className={`plan-day ${d === today ? 'today' : ''}`}>{dayName(d)}<small>{fmtDate(d).slice(0, 5)}</small></div>;
          })}
          {MEAL_TYPES.map((m) => (
            <div key={m} style={{ display: 'contents' }}>
              <div className="plan-meal">{MEAL_LABEL[m]}</div>
              {plan.days.map((_, i) => <div key={i}>{slotButton(i, m)}</div>)}
            </div>
          ))}
          <div className="plan-meal">Day total</div>
          {totals.days.map((t, i) => (
            <div key={i} className="plan-total">{t.meals ? <><b>{Math.round(t.kcal)}</b> kcal<br /><b className={t.protein >= data.settings.proteinTarget ? 'good' : ''}>{Math.round(t.protein)} g</b> protein<br />{money(t.cost, { cents: false })}</> : '—'}</div>
          ))}
        </div>

        <div className="plan-mobile stack">
          {plan.days.map((_, i) => {
            const d = addDays(week, i);
            const t = totals.days[i];
            return (
              <div key={i}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <b className={d === today ? 'good' : ''}>{dayName(d, false)} {fmtDate(d).slice(0, 5)}</b>
                  <span className="muted xs">{t.meals ? `${Math.round(t.kcal)} kcal · ${Math.round(t.protein)} g protein · ${money(t.cost, { cents: false })}` : ''}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                  {MEAL_TYPES.map((m) => <div key={m}><div className="xs muted" style={{ marginBottom: 2 }}>{MEAL_LABEL[m]}</div>{slotButton(i, m)}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {picking && (
        <SlotPicker
          week={week} day={picking.day} meal={picking.meal} plan={plan}
          current={plan.days[picking.day]?.[picking.meal]}
          onPick={(slot) => { setSlot(week, picking.day, picking.meal, slot); setPicking(null); }}
          onClose={() => setPicking(null)}
        />
      )}
      {confirmClear && <Confirm title="Clear this week's plan?" confirmLabel="Clear week" message="All meals for this week will be removed. You can undo straight after." onConfirm={() => useStore.getState().mutate((d) => { delete d.mealPlans[week]; }, 'Week cleared')} onClose={() => setConfirmClear(false)} />}
    </>
  );
}

function SlotPicker({ week, day, meal, plan, current, onPick, onClose }: { week: string; day: number; meal: MealType; plan: MealPlanWeek; current?: MealSlot; onPick: (s: MealSlot | null) => void; onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const [q, setQ] = useState('');
  const [servings, setServings] = useState(current?.servings || data.settings.householdSize);
  const [anyMeal, setAnyMeal] = useState(false);
  const [view, setView] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);
  const planProducts = useMemo(() => {
    const s = new Set<ID>();
    const rec = new Map(data.recipes.map((r) => [r.id, r]));
    plan.days.forEach((d, i) => Object.entries(d).forEach(([m, slot]) => { if (!(i === day && m === meal)) rec.get(slot!.recipeId)?.ingredients.forEach((x) => s.add(x.productId)); }));
    return s;
  }, [data.recipes, plan, day, meal]);
  const suggestions = useMemo(() => suggestRecipes(data, today, { mealType: anyMeal ? undefined : meal, planProductIds: planProducts }), [data, today, meal, anyMeal, planProducts]);
  const shown = suggestions.filter((s) => !q || s.recipe.name.toLowerCase().includes(q.toLowerCase()));
  const hidden = data.recipes.length - suggestions.length;
  return (
    <Modal wide title={`${MEAL_LABEL[meal]} · ${dayName(addDays(week, day), false)}`} sub="Best matches first. Tap a recipe to choose it, or its picture to see it." onClose={onClose}
      footer={<>
        {current && <button className="btn danger icon left" onClick={() => onPick(null)} aria-label="Remove meal" title="Remove meal"><Trash2 /></button>}
        <div className="stepper" aria-label="Servings">
          <button className="btn icon sm ghost" onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings"><Minus /></button>
          <span><b>{servings}</b> serving{servings === 1 ? '' : 's'}</span>
          <button className="btn icon sm ghost" onClick={() => setServings(servings + 1)} aria-label="More servings"><Plus /></button>
        </div>
        {current && servings !== current.servings && <button className="btn primary" onClick={() => onPick({ ...current, servings })}>Save</button>}
      </>}>
      <div className="picker-tools">
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <button className={`chip clickable ${anyMeal ? 'on' : ''}`} onClick={() => setAnyMeal(!anyMeal)} aria-pressed={anyMeal}>All meal types</button>
          <button className="chip clickable" onClick={() => setCreating(true)}><Plus /> New recipe</button>
        </div>
      </div>
      <div className="list">
        {shown.map((s) => {
          const extra = s.reasons.find((r) => !/a serving$/.test(r) && !/g protein$/.test(r));
          const isCurrent = current?.recipeId === s.recipe.id;
          return (
            <div key={s.recipe.id} className={`pick-row ${isCurrent ? 'current' : ''}`}>
              <button className="pick-img" onClick={() => setView(s.recipe)} aria-label={`View ${s.recipe.name}`}><RecipeImage recipe={s.recipe} height={56} /></button>
              <button className="pick-main" onClick={() => onPick({ recipeId: s.recipe.id, servings })} aria-label={`Choose ${s.recipe.name}`}>
                <span className="pick-name">{s.recipe.name}</span>
                <span className="pick-meta"><b>{Math.round(s.stats.protein)} g protein</b> · {money(s.stats.costPerServing, { cents: false })} · {s.recipe.prepMinutes} min · {s.stats.kcal} kcal</span>
                {isCurrent ? <span className="chip sage">Current</span> : extra && <span className="pick-why">{extra}</span>}
              </button>
            </div>
          );
        })}
        {shown.length === 0 && <p className="muted small">No recipes found.</p>}
      </div>
      {hidden > 0 && <p className="muted xs mt-8">{hidden} recipe{hidden === 1 ? ' is' : 's are'} hidden by your diet or meal-type settings.</p>}
      {view && <RecipeDetail recipe={view} onClose={() => setView(null)} onEdit={() => setView(null)} onPlan={() => onPick({ recipeId: view.id, servings })} />}
      {creating && <RecipeForm onClose={() => setCreating(false)} onSaved={(id) => onPick({ recipeId: id, servings })} />}
    </Modal>
  );
}
