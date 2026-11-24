# RandWise

A personal budgeting, grocery and meal-planning app for South Africa: ZAR, DD/MM/YYYY, debit orders, payday budget months, and Checkers / Food Lover's Market / Woolworths price tracking.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests for all budget, grocery, nutrition, shopping and parser maths
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/index.html
```

End-to-end tests (Playwright): `npm run build && npx vite preview --port 4173`, then `npm run e2e`.
They use `?today=2026-11-24` so the numbers are deterministic. You can add `?today=YYYY-MM-DD` to any URL to preview another date.

## What's in it

| Section | What it does |
|---|---|
| Dashboard | Safe-to-spend (after unpaid bills and planned savings) and a per-day amount, monthly totals, budget progress with warnings, upcoming debit orders with "Mark paid", insights, spending pace chart, grocery and goal summaries |
| Budget | Income lines, fixed/variable/savings categories (create, edit, delete, with due day and payment method), allocation bar, over-allocation warning, discretionary amount, copy last month |
| Transactions | Add/edit/delete with undo, filters by month, category, payment method and text, donut chart, planned vs actual, CSV export |
| Grocery budget | Monthly → weekly (× 7 ÷ days in month) and daily allowances, re-balanced weekly amount for the rest of the month, pace, spend per week and per store |
| Prices & specials | Price book per store, specials with end dates and savings, per-kg comparison with best buy, verified dates, catalogue import from pasted text or flyer photo (in-browser OCR), saved catalogue links |
| Recipes | 24 affordable, high-protein SA recipes plus your own; nutrition and cost per serving are calculated from ingredients |
| Meal planner | Week grid (breakfast, lunch, dinner, snacks), smart suggestions, auto-fill that reuses ingredients and pantry items, daily kcal/protein against targets |
| Shopping list | Combined quantities, pantry subtracted, whole-pack costing, cheapest store per item (overridable), specials savings, budget check, tick-off, "Finish shop" records the spend and moves leftovers to the pantry |
| Pantry | Quantities, expiry alerts, "cook with what you have" |
| Savings goals | Progress rings, required monthly amount, projected completion, contributions recorded as savings transactions |
| Reports | Monthly summary, where you saved / overspent, budget vs actual, 6-month trend, compare any two months |
| Settings | Budget month start day (e.g. 25th payday), household size, diet and excluded ingredients, nutrition targets, theme, CSV/JSON export, restore, sample data, reset |

Data is saved in the browser (localStorage). See `docs/ARCHITECTURE.md` for the design, data model, integration boundaries and roadmap, and `docs/schema.sql` for the proposed database schema.

**Prices:** bundled prices are *samples*, clearly labelled, so costing works on day one. There are no live retailer integrations. Prices come from your own entries and imports.
