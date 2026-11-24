// End-to-end smoke test. Run `npm run build && npx vite preview --port 4173` first, then `npm run e2e`.
// Uses a fixed "today" (?today=2026-11-24) so numbers are deterministic.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const TODAY = '2026-12-03';
const SHOTS = new URL('./screens/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const STAGE = process.env.STAGE || 'all';

let failures = 0;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    results.push(`  ✗ ${name}\n      ${String(e.message || e).split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const money = (s) => Number(String(s).replace(/[^\d.\-−]/g, '').replace('−', '-'));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
const go = (route) => page.goto(`${BASE}?today=${TODAY}#${route}`);

await step('first run shows onboarding and can set up a fresh budget', async () => {
  await go('dashboard');
  await page.getByText('Welcome to RandWise').waitFor();
  await page.getByText('Set up my own budget').click();
  assert((await page.getByLabel('Pay day').inputValue()) === '25', 'payday should default to the 25th');
  await page.getByLabel('Salary').fill('20 000');
  await page.getByLabel('Allowance').fill('5000');
  await page.getByLabel('Grocery budget').fill('2000');
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await page.getByTestId('safe-to-spend').waitFor();
  const v = money(await page.getByTestId('safe-to-spend').textContent());
  assert(v === 25000, `safe to spend should be 25000 (nothing committed yet), got ${v}`);
});

await step('grocery page splits R2,000 into weekly/daily allowances', async () => {
  await go('groceries');
  const weekly = money(await page.getByTestId('grocery-weekly').textContent());
  // December budget = 25 Nov – 24 Dec = 30 days → 2000 × 7 ÷ 30
  assert(Math.abs(weekly - 466.67) < 0.01, `weekly should be 466.67, got ${weekly}`);
});

await step('adding an expense updates grocery remaining and persists after reload', async () => {
  await page.getByRole('button', { name: 'Add purchase' }).click();
  await page.getByPlaceholder('e.g. Checkers weekly shop').fill('Checkers weekly shop');
  await page.getByLabel('Amount').fill('612,40');
  await page.getByLabel('Store').selectOption('checkers');
  await page.getByRole('button', { name: 'Add expense' }).last().click();
  await page.waitForTimeout(200);
  let rem = money(await page.getByTestId('grocery-remaining').textContent());
  assert(Math.abs(rem - 1387.6) < 0.001, `remaining should be 1387.60, got ${rem}`);
  await page.reload();
  rem = money(await page.getByTestId('grocery-remaining').textContent());
  assert(Math.abs(rem - 1387.6) < 0.001, `after reload remaining should be 1387.60, got ${rem}`);
});

await step('budget edits flow to the dashboard and over-allocation is flagged', async () => {
  await go('budget');
  const rent = page.getByLabel('Planned for Rent / bond');
  await rent.fill('30000');
  await rent.press('Enter');
  await page.getByText('Over-allocated by').waitFor();
  await rent.fill('8500');
  await rent.press('Enter');
  await page.getByText('Still to allocate').waitFor();
  const un = money(await page.getByTestId('unallocated').textContent());
  assert(un === 25000 - 2000 - 8500, `unallocated should be 14500, got ${un}`);
  await go('dashboard');
  const v = money(await page.getByTestId('safe-to-spend').textContent());
  // income 25000 − spent 612.40 − unpaid rent 8500 − grocery? (variable isn't reserved) = 15887.60
  assert(Math.abs(v - 15887.6) < 0.001, `safe to spend should be 15887.60, got ${v}`);
});

await step('commission: add an estimate, mark it received lower, and the money adjusts', async () => {
  await go('budget');
  await page.getByRole('button', { name: 'Commission', exact: true }).click();
  const est = page.getByLabel('Commission expected');
  await est.fill('4000');
  await est.press('Enter');
  await page.waitForTimeout(100);
  let exp = money(await page.getByTestId('income-expected').textContent());
  assert(exp === 29000, `expected income should be 29000, got ${exp}`);
  await page.getByTestId('income-commission').getByRole('button', { name: 'Mark as received' }).click();
  await page.getByLabel('Commission received').fill('3200');
  await page.getByRole('button', { name: 'Confirm amount received' }).click();
  await page.getByText('less than expected').waitFor();
  const actual = money(await page.getByTestId('income-total').textContent());
  assert(actual === 28200, `actual income should be 28200, got ${actual}`);
  await go('dashboard');
  await page.getByText('came in R800 lower than planned').waitFor();
  const v = money(await page.getByTestId('safe-to-spend').textContent());
  assert(Math.abs(v - (15887.6 + 3200)) < 0.001, `safe to spend should include actual commission, got ${v}`);
});

await step('transactions can be edited and deleted (with undo)', async () => {
  await go('transactions');
  await page.getByText('Checkers weekly shop').first().click();
  await page.getByLabel('Amount').fill('700');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('R700.00').first().waitFor();
  await page.getByText('Checkers weekly shop').first().click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByText('No transactions here').waitFor();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByText('Checkers weekly shop').first().waitFor();
});

await step('sample data loads and every page renders without errors', async () => {
  await go('preferences');
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await page.getByRole('button', { name: 'Load sample data' }).last().click();
  for (const r of ['today', 'reset', 'habits', 'workouts', 'dashboard', 'budget', 'transactions', 'groceries', 'savings', 'reports', 'meals', 'recipes', 'shopping', 'pantry', 'prices', 'preferences']) {
    await go(r);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}${r}.png`, fullPage: true });
  }
  assert(errors.length === 0, `console errors: ${errors.slice(0, 3).join(' | ')}`);
});

if (STAGE !== '1') {
  const { stage2 } = await import('./stage2.mjs');
  await stage2({ page, go, step, assert, money, SHOTS });
}

await step('setting up the day before payday opens next month with no late-income warnings', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await c.newPage();
  await p.goto(`${BASE}?today=2026-11-24#budget`);
  await p.getByText('Set up my own budget').click();
  await p.getByText('First budget: December 2026 (25/11/2026 – 24/12/2026)').waitFor();
  await p.getByLabel('Salary').fill('20000');
  await p.getByLabel('Allowance').fill('3000');
  await p.getByRole('button', { name: 'Start budgeting' }).click();
  await p.getByText("You're planning").waitFor();
  assert((await p.locator('.period-nav .lbl').first().textContent()).startsWith('December 2026'), 'budget page should show December');
  assert((await p.getByText('not marked received').count()) === 0, 'no late warnings expected');
  assert((await p.getByText('Due 25/11/2026').count()) === 2, 'salary and allowance should be due 25/11/2026');
  await c.close();
});

await step('mobile layout has bottom navigation and no horizontal scroll', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mp = await m.newPage();
  await mp.goto(`${BASE}?today=${TODAY}#dashboard`);
  await mp.evaluate((d) => localStorage.setItem('randwise:data:v1', d), await page.evaluate(() => localStorage.getItem('randwise:data:v1')));
  for (const r of ['today', 'reset', 'habits', 'workouts', 'dashboard', 'budget', 'meals', 'shopping']) {
    await mp.goto(`${BASE}?today=${TODAY}#${r}`);
    await mp.reload();
    await mp.waitForTimeout(250);
    await mp.screenshot({ path: `${SHOTS}mobile-${r}.png`, fullPage: true });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${r}: page scrolls horizontally by ${overflow}px`);
  }
  assert(await mp.locator('.bottom-nav').isVisible(), 'bottom nav not visible');
  await mp.goto(`${BASE}?today=${TODAY}#budget`);
  const box = await mp.getByLabel('Planned for Rent / bond').boundingBox();
  assert(box && box.width >= 100 && box.height >= 40, `phone budget amount box too small: ${JSON.stringify(box)}`);
  const fs = await mp.getByLabel('Planned for Rent / bond').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  assert(fs >= 16, `phone input text should be at least 16px, got ${fs}`);
  await m.close();
});

await browser.close();
console.log(results.join('\n'));
console.log(failures ? `\n${failures} failed` : '\nAll passed');
process.exit(failures ? 1 : 0);
