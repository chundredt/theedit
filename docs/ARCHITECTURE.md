# TheEdit — architecture & roadmap

TheEdit is a personal budgeting and meal-planning app for South Africa (ZAR, DD/MM/YYYY,
SA supermarkets). This document is the plan the build follows.

## 1. Architecture

```
┌──────────────────────────── UI (React pages) ────────────────────────────┐
│ Dashboard · Budget · Transactions · Savings · Reports                   │
│ Groceries · Meal plan · Recipes · Shopping list · Pantry · Prices       │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ reads state, calls actions
┌───────────────▼──────────────┐     ┌─────────────────────────────────────┐
│ Store (zustand)              │────▶│ Domain logic (pure TS, unit-tested)  │
│ one AppData document +       │     │ period · budget · grocery · prices   │
│ typed actions (CRUD)         │     │ nutrition · shopping list · savings │
└───────────────┬──────────────┘     │ reports · flyer text parser         │
                │ save / load        └─────────────────────────────────────┘
┌───────────────▼──────────────┐
│ StorageAdapter interface     │  LocalStorageAdapter today;
│ load() / save(data)          │  ApiAdapter (Postgres + auth) later
└──────────────────────────────┘
```

* **Pages never calculate money themselves.** Every number on screen comes from a pure
  function in `src/domain`, so the dashboard, budget page and reports can never disagree,
  and the maths is covered by unit tests.
* **Derived, not duplicated.** "Spent", "remaining", "paid", "goal progress", grocery
  spend, shopping-list cost are all computed from source records (budgets, transactions,
  prices) every render. Editing a budget instantly updates every screen.
* **Persistence** goes through `StorageAdapter` (`src/data/storage.ts`). The data is a
  versioned JSON document with migrations, so a server-backed adapter can be dropped in
  without touching pages.

## 2. How the sections work together

| Source record | Feeds |
|---|---|
| Budget period (income + allocation per category) | Dashboard totals, budget bars, safe-to-spend, grocery budget, reports |
| Transactions | Spent per category, bill "paid" status, grocery spend, savings-goal progress, reports |
| Fixed categories with a due day | Upcoming debit orders / bills; "Mark paid" creates the transaction |
| Savings goals (linked to a savings category) | Contributions are transactions in that category, so budget and goal agree |
| Products + store prices | Recipe cost per serving, shopping-list cost, best-store recommendations |
| Recipes + meal plan | Weekly nutrition, shopping list |
| Pantry | Subtracted from the shopping list; boosts recipe suggestions; expiry alerts |
| "Complete shop" | Creates grocery transactions (grocery budget updates), moves leftover pack quantities into the pantry |

**Budget month.** Many South Africans are paid on the 25th, so the budget month can start on
any day (Settings). A period is named after the month it ends in (25 Oct – 24 Nov = "November").

## 3. Data model

Proposed relational schema (what a real database would use) is in `docs/schema.sql`.
Locally, the same entities live in one JSON document:

* `settings` — budget start day, household size, diet, excluded products, nutrition targets
* `categories` — id, name, group (fixed / variable / savings), colour, due day, payment method
* `budgets[periodKey]` — income lines, allocation per category
* `transactions` — date, description, amount, category, payment method, notes, goal link
* `goals` — name, target, opening balance, target date, planned monthly contribution, category
* `stores`, `products` (with nutrition per 100 g, pack size, diet tags), `prices`
  (store, price, pack size, special flag + end date, date verified, source)
* `catalogues` — store, title, link, valid from/to
* `recipes` — ingredients in grams, steps, prep time, servings, tags, image
* `mealPlans[weekStart]` — 7 days × breakfast/lunch/dinner/snack slots
* `shopping[weekStart]` — ticked items, store overrides, completed flag
* `pantry` — product, quantity, expiry date

Recipe calories / protein / carbs / fat are **calculated from ingredient nutrition**, so a
recipe you create gets macros automatically. Cost per serving uses the cheapest current price.

## 4. What works now vs. what needs integrations

Works fully offline today: budgets, expenses, bills, savings, reports, recipes, meal plan,
shopping list, pantry, manual prices, specials with expiry, price comparison, CSV/JSON export
and JSON restore, pasted-text catalogue parsing, flyer photo text extraction (OCR runs in the
browser; it downloads its engine on first use, so it needs internet once).

Needs external integration (not faked): live Checkers / Food Lover's / Woolworths prices and
specials (no public APIs; scraping their sites breaks their terms and fails CORS in a browser),
automatic catalogue fetching from a link, bank feeds (e.g. via an aggregator such as Stitch),
multi-device sync and login. Catalogue links are stored so you can open them; the
`PriceSource` interface in `src/domain/prices.ts` is where a future integration plugs in.

Bundled prices are **sample prices** marked "verify" with an old verified date — they're
there so costing works on day one; replace them with real prices from your shops.

## 5. Roadmap

1. **Stage 1** — foundations, dashboard, budget setup, expense tracker, grocery budget.
2. **Stage 2** — product & price database, specials, comparison, catalogue import, recipes,
   meal planner, shopping list, pantry.
3. **Stage 3** — savings goals, monthly reports and comparison, export/backup.
4. **Later** — server (Postgres + auth) via `ApiStorageAdapter`, PWA/offline install, bank
   statement CSV import, shared household budgets, price integrations if retailers open APIs.
