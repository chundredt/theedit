// Stage 2 & 3 flows: food log, shopping list, savings, reports, wellness. Runs after sample data is loaded.
export async function stage2({ page, go, step, assert, money, SHOTS }) {
  const kcalNow = async () => Number((await page.getByTestId('kcal-today').textContent()).replace(/[^\d]/g, ''));

  await step('food log: type a breakfast and the calories fill in', async () => {
    await go('meals');
    const before = await kcalNow();
    await page.getByRole('button', { name: 'Add to breakfast' }).click();
    await page.getByLabel('What did you eat?').fill('2 eggs, 2 slices toast, coffee with milk');
    assert((await page.getByLabel('Calories in 2 eggs').inputValue()) === '156', 'eggs should be 156 kcal');
    await page.locator('.modal').getByText('346 kcal').waitFor();
    await page.locator('.modal').getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByTestId('meal-breakfast').getByText('2 eggs').waitFor();
    assert((await kcalNow()) === before + 346, `kcal should rise by 346 (${before} → ${await kcalNow()})`);
    await page.screenshot({ path: `${SHOTS}food-log.png`, fullPage: true });
  });

  await step('unknown food: type the calories once and it is remembered', async () => {
    await page.getByRole('button', { name: 'Add to snacks' }).click();
    await page.getByLabel('What did you eat?').fill('grandma special');
    await page.locator('.modal').getByText('Not sure of this one').waitFor();
    await page.getByLabel('Calories in Grandma special').fill('420');
    await page.locator('.modal').getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Add to snacks' }).click();
    await page.getByLabel('What did you eat?').fill('2 grandma special');
    assert((await page.getByLabel('Calories in 2 grandma special').inputValue()) === '840', 'remembered food should scale');
    await page.locator('.modal').getByRole('button', { name: 'Add Grandma special' }).waitFor();
    await page.getByRole('button', { name: 'Close' }).click();
  });

  await step('planning: plan tomorrow, then tick a planned meal as eaten', async () => {
    await page.getByRole('tab', { name: /^Friday 4/ }).click();
    await page.getByRole('button', { name: 'Add to dinner' }).click();
    await page.getByLabel('What did you eat?').fill('steak and salad');
    await page.locator('.modal').getByRole('button', { name: 'Plan it' }).click();
    await page.getByTestId('meal-dinner').locator('.food-row.planned', { hasText: 'Steak' }).waitFor();
    await page.getByRole('button', { name: 'Back to today' }).click();
    const before = await kcalNow();
    await page.getByTestId('meal-lunch').getByRole('button', { name: 'Ate it' }).click();
    assert((await kcalNow()) > before, 'ticking lunch should add calories');
  });

  await step('shopping list: add planned food, add items, tick them off', async () => {
    await page.getByRole('button', { name: 'Add to shopping list' }).click();
    await page.locator('.modal').getByText('Steak', { exact: true }).waitFor();
    await page.locator('.modal').getByRole('button', { name: /^Add \d+/ }).click();
    await go('shopping');
    await page.getByText('Steak', { exact: true }).waitFor();
    await page.getByLabel('Add to list').fill('bread, butter');
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByRole('button', { name: 'Got Bread' }).click();
    await page.getByText('In the trolley').waitFor();
    assert((await page.getByText('Checkers').count()) === 0, 'no store names');
    await page.screenshot({ path: `${SHOTS}shopping.png`, fullPage: true });
  });

  await step('till slip: type the total and it lands in grocery spending', async () => {
    await go('groceries');
    const before = money(await page.getByTestId('grocery-remaining').textContent());
    await page.getByRole('button', { name: 'Scan till slip' }).click();
    await page.getByRole('button', { name: 'Type it instead' }).click();
    await page.getByLabel('Slip total').fill('345.50');
    await page.getByRole('button', { name: 'Add to groceries' }).click();
    await page.waitForTimeout(150);
    const after = money(await page.getByTestId('grocery-remaining').textContent());
    assert(Math.abs(before - after - 345.5) < 0.01, `remaining ${before} → ${after}`);
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

  await step('today: tick habits, count water and mark the workout done', async () => {
    await go('today');
    const count = page.getByTestId('today-habits').locator('.count');
    const before = parseInt(await count.textContent());
    await page.getByRole('button', { name: 'Complete 8,000 steps' }).click();
    await page.getByRole('button', { name: 'Undo 8,000 steps' }).waitFor();
    const after = parseInt(await count.textContent());
    assert(after === before - 1, `habits left ${before} → ${after}`);
    await page.getByRole('button', { name: 'More Drink water' }).click();
    await page.getByText('1 of 2 L').waitFor();
    await page.getByTestId('today-workout').getByRole('button', { name: 'Mark done' }).click();
    await page.getByTestId('today-workout').getByText('Done · 30 minutes').waitFor();
    await page.reload();
    await page.getByText('1 of 2 L').waitFor();
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

  await step('+ offers four things: water adds a glass, expense opens the form', async () => {
    const c = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
    const p = await c.newPage();
    await p.goto(page.url().replace(/#.*$/, '#today'));
    await p.evaluate((d) => localStorage.setItem('randwise:data:v1', d), await page.evaluate(() => localStorage.getItem('randwise:data:v1')));
    await p.reload();
    await p.getByRole('button', { name: 'Add', exact: true }).click();
    assert((await p.locator('.quick-tile').count()) === 4, 'the + menu should offer four things');
    await p.screenshot({ path: `${SHOTS}quick-add.png` });
    await p.locator('.modal').getByRole('button', { name: /Water/ }).click();
    await p.getByText(/💧 .* of 2 L/).first().waitFor();
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
