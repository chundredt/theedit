// End-to-end smoke test. Run `npm run build && npx vite preview --port 4173` first, then `npm run e2e`.
// Uses a fixed "today" (?today=2026-11-24) so numbers are deterministic.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const TODAY = '2026-11-24';
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
  await page.getByLabel('Monthly income').fill('25 000');
  await page.getByLabel('Grocery budget').fill('2000');
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await page.getByTestId('safe-to-spend').waitFor();
  const v = money(await page.getByTestId('safe-to-spend').textContent());
  assert(v === 25000, `safe to spend should be 25000 (nothing committed yet), got ${v}`);
});

await step('grocery page splits R2,000 into weekly/daily allowances', async () => {
  await go('groceries');
  const weekly = money(await page.getByTestId('grocery-weekly').textContent());
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
  for (const r of ['dashboard', 'budget', 'transactions', 'groceries', 'savings', 'reports', 'meals', 'recipes', 'shopping', 'pantry', 'prices', 'preferences']) {
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

await step('mobile layout has bottom navigation and no horizontal scroll', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mp = await m.newPage();
  await mp.goto(`${BASE}?today=${TODAY}#dashboard`);
  await mp.evaluate((d) => localStorage.setItem('randwise:data:v1', d), await page.evaluate(() => localStorage.getItem('randwise:data:v1')));
  for (const r of ['dashboard', 'budget', 'meals', 'shopping']) {
    await mp.goto(`${BASE}?today=${TODAY}#${r}`);
    await mp.reload();
    await mp.waitForTimeout(250);
    await mp.screenshot({ path: `${SHOTS}mobile-${r}.png`, fullPage: true });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${r}: page scrolls horizontally by ${overflow}px`);
  }
  assert(await mp.locator('.bottom-nav').isVisible(), 'bottom nav not visible');
  await m.close();
});

await browser.close();
console.log(results.join('\n'));
console.log(failures ? `\n${failures} failed` : '\nAll passed');
process.exit(failures ? 1 : 0);
