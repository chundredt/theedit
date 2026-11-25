# TheEdit

A personal budgeting, food-log and daily-habits app for South Africa: ZAR, DD/MM/YYYY, debit orders and payday budget months.

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
| Today | Free to spend today, today's calories and protein by meal, habits and workout to tick off, one reminder at a time, daily challenge |
| Money | Overview (free to spend, what's left per category, bills coming up), Budget (income lines, categories, plan vs income), Spending, Savings and yearly costs, Report |
| Food log | Type what you ate ("2 eggs, toast, coffee with milk") and calories and protein fill in from a built-in list of common SA portions and the ingredient list; unknown foods are typed once and remembered; favourites, recent foods and "same as yesterday" are one tap. Future days are a plan: copy a day, repeat last week, tick "Ate it" on the day |
| Shopping list | Plain checklist; can pull in the foods planned for the rest of the week |
| Grocery money | Monthly → weekly allowance, what's left each week, purchases; a till slip photo adds its total |
| Me | Habits, workouts, weekly reset, settings (payday, calorie and protein targets, theme, export, backup, sample data) |

Data is saved in the browser (localStorage). See `docs/ARCHITECTURE.md` for the design, data model, integration boundaries and roadmap, and `docs/schema.sql` for the proposed database schema.

