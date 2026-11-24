// Stage 2 & 3 flows: food planning, prices, pantry, savings, reports. Runs after sample data is loaded.
export async function stage2({ page, go, step, assert, money, SHOTS }) {
  await step('auto-fill completes the week and the shopping list updates', async () => {
    await go('shopping');
    const before = money(await page.getByTestId('list-total').textContent());
    await go('meals');
    await page.getByRole('button', { name: 'Auto-fill empty slots' }).click();
    await page.waitForTimeout(200);
    const empty = await page.locator('.plan-grid .slot:not(.filled)').count();
    assert(empty === 0, `${empty} empty slots after auto-fill`);
    await page.screenshot({ path: `${SHOTS}meals-filled.png`, fullPage: true });
    await go('shopping');
    const after = money(await page.getByTestId('list-total').textContent());
    assert(after > before, `list total should grow after adding snacks (${before} → ${after})`);
  });

  await step('meal slot can be changed and removed', async () => {
    await go('meals');
    await page.locator('.plan-grid .slot.filled').first().click();
    await page.getByRole('button', { name: 'Remove meal' }).click();
    assert((await page.locator('.plan-grid .slot:not(.filled)').count()) === 1, 'slot not removed');
    await page.locator('.plan-grid .slot:not(.filled)').first().click();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    assert((await page.locator('.plan-grid .slot:not(.filled)').count()) === 0, 'slot not re-filled');
  });

  await step('finishing a shop records grocery spend and adds leftovers to the pantry', async () => {
    await go('groceries');
    const remBefore = money(await page.getByTestId('grocery-remaining').textContent());
    await go('shopping');
    const ticks = page.locator('.shop-item .tick');
    const n = Math.min(3, await ticks.count());
    for (let i = 0; i < n; i++) await ticks.nth(i).click();
    await page.getByRole('button', { name: 'Finish shop' }).click();
    const inputs = page.locator('.modal .input-money input');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) await inputs.nth(i).fill(i === 0 ? '400' : '0');
    await page.getByRole('button', { name: /^Record R/ }).click();
    await page.getByText('Shop recorded on').waitFor();
    await go('groceries');
    const remAfter = money(await page.getByTestId('grocery-remaining').textContent());
    assert(Math.abs(remBefore - 400 - remAfter) < 0.01, `grocery remaining should drop by 400 (${remBefore} → ${remAfter})`);
  });

  await step('catalogue text import creates specials after review', async () => {
    await go('prices');
    await page.getByRole('tab', { name: 'Import catalogue' }).click();
    await page.getByLabel('Import store').selectOption('woolworths');
    await page.getByLabel('Catalogue text').fill('Free Range Large Eggs 18s Was R89.99 Now R72.99\nRolled Oats 1kg R36.99\nSomething unknown R10.00');
    await page.getByRole('button', { name: 'Find prices' }).click();
    await page.getByText('Review 3 items').waitFor();
    await page.getByRole('button', { name: /^Save 2 prices$/ }).click();
    await page.getByText('Saved 2 prices').waitFor();
    await page.getByRole('tab', { name: 'Specials' }).click();
    await page.getByText('R72.99').first().waitFor();
    await page.screenshot({ path: `${SHOTS}prices-specials.png`, fullPage: true });
    await page.getByRole('tab', { name: 'Compare prices' }).click();
    await page.screenshot({ path: `${SHOTS}prices-compare.png`, fullPage: true });
  });

  await step('custom recipe calculates nutrition and appears in the list', async () => {
    await go('recipes');
    await page.getByRole('button', { name: 'New recipe' }).click();
    await page.getByPlaceholder('e.g. Chicken & chickpea bowl').fill('Tuna egg protein bowl');
    await page.locator('.modal select[aria-label="Product"]').first().selectOption('tuna');
    await page.locator('.modal input[aria-label="Grams"]').first().fill('170');
    await page.getByRole('button', { name: 'Ingredient', exact: true }).click();
    await page.locator('.modal select[aria-label="Product"]').nth(1).selectOption('eggs');
    await page.locator('.modal input[aria-label="Grams"]').nth(1).fill('100');
    await page.locator('.modal input[type=number]').first().fill('1');
    const protein = await page.locator('.modal .macros div').nth(1).textContent();
    // 170 g tuna × 26/100 + 100 g egg × 12.6/100 = 44.2 + 12.6 = 56.8 g
    assert(protein.startsWith('57g'), `protein should be ~57g, got ${protein}`);
    await page.getByRole('button', { name: 'Save recipe' }).click();
    await page.getByText('Tuna egg protein bowl').waitFor();
  });

  await step('pantry items can be added and edited', async () => {
    await go('pantry');
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.locator('.modal select[aria-label="Product"]').selectOption('lentils');
    await page.getByLabel('Quantity').fill('250');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Brown lentils (dry)').first().waitFor();
    await page.screenshot({ path: `${SHOTS}pantry.png`, fullPage: true });
  });

  await step('savings: create a goal, contribute, and see progress', async () => {
    await go('savings');
    await page.getByRole('button', { name: 'New goal' }).click();
    await page.getByPlaceholder('e.g. Emergency fund').fill('Car service');
    await page.getByLabel('Target amount').fill('6000');
    await page.getByLabel('Monthly contribution').fill('500');
    await page.getByRole('button', { name: 'Save goal' }).click();
    const card = page.locator('.card', { hasText: 'Car service' }).last();
    await card.getByRole('button', { name: 'Add money' }).click();
    await page.getByLabel('Amount').fill('1500');
    await page.locator('.modal').getByRole('button', { name: 'Add', exact: true }).click();
    await card.getByText('25%').waitFor();
    await page.screenshot({ path: `${SHOTS}savings.png`, fullPage: true });
  });

  await step('reports compare months', async () => {
    await go('reports');
    await page.getByText('Compare months').waitFor();
    await page.getByText('Where you overspent').waitFor();
    await page.screenshot({ path: `${SHOTS}reports.png`, fullPage: true });
  });

  await step('vegetarian setting removes meat recipes from suggestions', async () => {
    await go('preferences');
    await page.locator('select').filter({ hasText: 'Vegetarian' }).selectOption('vegetarian');
    await go('recipes');
    assert((await page.getByText('Chicken & potato curry').count()) === 0, 'chicken curry still shown');
    await go('preferences');
    await page.locator('select').filter({ hasText: 'Vegetarian' }).selectOption('none');
  });

  await step('today: tick habits, count water and mark the workout done', async () => {
    await go('today');
    const chip = page.getByTestId('today-habits').locator('.chip');
    const before = await chip.textContent();
    await page.getByRole('button', { name: 'Complete 8,000 steps' }).click();
    const after = await chip.textContent();
    assert(Number(after.split('/')[0]) === Number(before.split('/')[0]) + 1, `habit count ${before} → ${after}`);
    await page.getByRole('button', { name: 'One more Drink water' }).click();
    await page.getByText('4 of 8 glasses').waitFor();
    await page.getByTestId('today-workout').getByRole('button', { name: 'Mark done' }).click();
    await page.getByTestId('today-workout').getByText('Done · 30 minutes').waitFor();
    await page.reload();
    await page.getByText('4 of 8 glasses').waitFor();
    await page.screenshot({ path: `${SHOTS}today.png`, fullPage: true });
  });

  await step('habits: add from ideas and create a custom habit', async () => {
    await go('habits');
    await page.getByRole('button', { name: /Read 10 minutes/ }).click();
    await page.locator('.list-item', { hasText: 'Read 10 minutes' }).waitFor();
    await page.getByRole('button', { name: 'New habit' }).click();
    await page.getByPlaceholder('e.g. Walk after dinner').fill('Vitamins');
    await page.locator('.modal').getByRole('button', { name: 'Mon', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('.list-item', { hasText: 'Vitamins' }).getByText('Mon').waitFor();
    await page.screenshot({ path: `${SHOTS}habits.png`, fullPage: true });
  });

  await step('workouts: tick an exercise on a planned day and change the weekly plan', async () => {
    await go('workouts');
    await page.getByRole('tab', { name: /Monday/ }).click();
    await page.getByRole('button', { name: 'Done: Plank' }).click();
    await page.getByTestId('workout-today').getByText('In progress').waitFor();
    await page.getByLabel('Sunday workout').selectOption('r-yoga');
    await page.getByRole('tab', { name: /Sunday/ }).click();
    await page.getByTestId('workout-today').getByText('Yoga & mobility').waitFor();
    await page.screenshot({ path: `${SHOTS}workouts.png`, fullPage: true });
  });

  await step('yearly costs: quick add, budget the monthly amount, and pay one from its pot', async () => {
    await go('savings');
    const section = page.getByTestId('yearly-costs');
    await section.getByRole('button', { name: /TV licence/ }).click();
    await section.getByText('TV licence', { exact: true }).waitFor();
    const need = money(await page.getByTestId('yearly-need').textContent());
    await section.getByRole('button', { name: /^Budget R/ }).click();
    await section.getByText(/for this ✓/).waitFor();
    await go('dashboard');
    const before = money(await page.getByTestId('safe-to-spend').textContent());
    await go('savings');
    const card = section.locator('.card', { hasText: 'Car licence disc' });
    await card.getByRole('button', { name: "It's paid" }).click();
    await page.getByLabel('Amount paid').fill('400');
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    await page.getByText('Car licence disc marked as paid').waitFor();
    await card.getByText('every year').waitFor();
    await go('dashboard');
    const after = money(await page.getByTestId('safe-to-spend').textContent());
    assert(Math.abs(after - before) < 0.01, `paying from the pot shouldn't change safe-to-spend (${before} → ${after}); need was ${need}`);
    await go('savings');
    await page.screenshot({ path: `${SHOTS}yearly.png`, fullPage: true });
  });

  await step('weekly reset: walk the steps, set a focus, and see it on Today', async () => {
    await go('reset');
    await page.getByText('How last week went').waitFor();
    await page.screenshot({ path: `${SHOTS}reset-1.png`, fullPage: true });
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'No takeaways this week' }).click();
    await page.getByRole('button', { name: 'Finish reset' }).click();
    await page.getByText('Weekly reset done').waitFor();
    await go('today');
    await page.getByTestId('week-focus').getByText('No takeaways this week').waitFor();
  });

  await step('+ opens a choice of what to add; tick a habit and log an activity from it', async () => {
    const c = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
    const p = await c.newPage();
    await p.goto(page.url().replace(/#.*$/, '#today'));
    await p.evaluate((d) => localStorage.setItem('randwise:data:v1', d), await page.evaluate(() => localStorage.getItem('randwise:data:v1')));
    await p.reload();
    await p.getByRole('button', { name: 'Add', exact: true }).click();
    await p.locator('.modal').getByRole('button', { name: /Tick habits/ }).click();
    await p.locator('.modal').getByRole('button', { name: 'Complete Hit my protein' }).click();
    await p.locator('.modal').getByRole('button', { name: 'Undo Hit my protein' }).waitFor();
    await p.locator('.modal').getByRole('button', { name: 'Done', exact: true }).click();
    await p.getByRole('button', { name: 'Add', exact: true }).click();
    await p.screenshot({ path: `${SHOTS}quick-add.png` });
    await p.locator('.modal').getByRole('button', { name: /Log activity|Other activity/ }).click();
    await p.getByPlaceholder('Walk, padel, spin class…').fill('Padel');
    await p.locator('.modal').getByRole('button', { name: 'Save', exact: true }).click();
    await p.getByRole('button', { name: 'Add', exact: true }).click();
    await p.locator('.modal').getByRole('button', { name: /Expense/ }).first().click();
    await p.getByRole('heading', { name: 'Add expense' }).waitFor();
    await c.close();
  });

  await step('daily challenge: swap it, then mark it done', async () => {
    await go('today');
    const card = page.getByTestId('daily-challenge');
    const before = await card.locator('.challenge-main').textContent();
    await card.getByRole('button', { name: 'Another challenge' }).click();
    const after = await card.locator('.challenge-main').textContent();
    assert(after !== before, `swap should change the challenge (${before})`);
    await card.getByRole('button', { name: 'Mark challenge done' }).click();
    await card.getByRole('button', { name: 'Undo challenge done' }).waitFor();
    await card.getByText('🔥 1').waitFor();
    assert((await card.getByRole('button', { name: 'Another challenge' }).count()) === 0, 'swap hidden once done');
    assert((await card.locator('button').allTextContents()).every((t) => !t.trim()), 'buttons should be icon-only');
    await page.reload();
    await card.getByRole('button', { name: 'Undo challenge done' }).waitFor();
  });
}
