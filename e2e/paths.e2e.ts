import { expect, test, type Page } from '@playwright/test';
import scenario from '../src/content/scenario.json' with { type: 'json' };

const metricLabel = (id: string) => scenario.metrics.find(m => m.id === id)!.label;
const evidenceText = (id: string) => scenario.evidence.find(e => e.id === id)!.text;

// Every screen must fit the viewport: no horizontal page scroll at any width.
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

// The score and right/wrong feedback must stay hidden until the results screen.
async function expectScoreHidden(page: Page) {
  await expect(page.getByText('מתוך 100')).toHaveCount(0);
  await expect(page.locator('.score-circle')).toHaveCount(0);
}

// No back buttons; the only way back is the advanced path's reselect option.
async function expectNoBackButton(page: Page) {
  await expect(page.getByRole('button', {name: /חזרה|חזור|הקודם/})).toHaveCount(0);
}

async function checkStage(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectScoreHidden(page);
  await expectNoBackButton(page);
}

async function start(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', {name: 'מתחילים במשימה'}).click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('מה מסתתר מאחורי התוצאות?');
}

async function pickSignals(page: Page, ids: string[]) {
  for (const id of ids) await page.getByRole('button', {name: `בחר לבדיקה ${metricLabel(id)}`}).click();
  await checkStage(page);
  await page.getByRole('button', {name: 'להמשך החקירה'}).click();
}

const choose = (page: Page, text: string) => page.locator('label').filter({hasText: text}).first().click();

async function finishFromSecond(page: Page, take: string) {
  await choose(page, take);
  await checkStage(page);
  await page.getByRole('button', {name: 'לגיבוש ההערכה'}).click();

  await expect(page.getByRole('heading', {level: 1})).toHaveText('מהי בעיית השורש?');
  await choose(page, 'צמיחת האשראי המואצת מגדילה את צורכי המימון');
  await choose(page, 'שחיקה בפיקדונות הקמעונאיים ומעבר למימון');
  await choose(page, 'גוברת הרגישות לזמינות');
  await choose(page, 'אלה נתונים ממתנים חשובים');
  await choose(page, 'ריכוזיות האשראי בענף הבינוי והנדל״ן מצדיקה בירור נפרד');
  await checkStage(page);
  await page.getByRole('button', {name: 'להכרעה פיקוחית'}).click();

  // Every path receives the same fact sheet before the final decision.
  await expect(page.locator('.final-facts li')).toHaveCount(7);
  await choose(page, 'בירור פיקוחי ממוקד');
  await checkStage(page);
  await page.getByRole('button', {name: 'לחשיפת התוצאה'}).click();

  await expect(page.getByText('מתוך 100')).toBeVisible();
  await expectNoHorizontalScroll(page);
  return Number(await page.locator('.score-circle strong').textContent());
}

test('opening screen blocks continuing without a metric and caps at three', async ({page}) => {
  await start(page);
  const next = page.getByRole('button', {name: 'להמשך החקירה'});
  await expect(next).toBeDisabled();
  for (const id of ['roe', 'cet1', 'lcr']) await page.getByRole('button', {name: `בחר לבדיקה ${metricLabel(id)}`}).click();
  await expect(page.getByText('נבחרו 3 / 3')).toBeVisible();
  await expect(page.getByRole('button', {name: `בחר לבדיקה ${metricLabel('nsfr')}`})).toBeDisabled();
  await expect(next).toBeEnabled();
});

test('advanced path: both distractors shown, preferred answer reaches the shared decision', async ({page}) => {
  await start(page);
  await pickSignals(page, ['loans', 'retail']);
  await choose(page, 'אדבוק בבחירה הראשונה שלי');
  await checkStage(page);
  await page.getByRole('button', {name: 'למסמך הבא'}).click();

  await expect(page.getByText('הסיכון טופל ולכן אינו עוד מוקד מרכזי')).toBeVisible();
  await expect(page.getByText('מוקד הסיכון הוא כעת הרווחיות והמודל העסקי')).toBeVisible();
  const total = await finishFromSecond(page, 'אני משאיר את הערכת הסיכון המרכזית, עם הסתייגויות');
  expect(total).toBe(94);
});

test('advanced path: "risk is managed" returns to data selection', async ({page}) => {
  await start(page);
  await pickSignals(page, ['loans', 'financial']);
  await choose(page, 'כן, הסיכון מנוהל');
  await page.getByRole('button', {name: 'חזרה לבחירת נתונים'}).click();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('מה מסתתר מאחורי התוצאות?');
  await expect(page.getByText('נבחרו 0 / 3')).toBeVisible();
});

for (const {name, signal, keys} of [
  {name: 'credit', signal: 'loans', keys: ['deposit_gap', 'wholesale_growth']},
  {name: 'funding', signal: 'retail', keys: ['credit_growth', 'credit_acceleration']},
]) {
  test(`${name} path: opposite-domain evidence leads to the advanced document`, async ({page}) => {
    await start(page);
    await pickSignals(page, [signal]);
    for (const id of keys) await page.getByRole('button', {name: evidenceText(id)}).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await checkStage(page);
    await page.getByRole('button', {name: 'למסמך הבא'}).click();
    const total = await finishFromSecond(page, 'אני משאיר את הערכת הסיכון המרכזית, עם הסתייגויות');
    expect(total).toBeGreaterThanOrEqual(84);
  });
}

test('decoy path: manager offers all four options, "no further inquiry" skips the document', async ({page}) => {
  await start(page);
  await pickSignals(page, ['roe']);
  for (const title of ['לבחון את התפתחות תיק האשראי', 'לבחון את הרכב מקורות המימון', 'להעמיק בממצא הנוכחי', 'לא נדרשת חקירה נוספת'])
    await expect(page.locator('label').filter({hasText: title})).toBeVisible();
  await choose(page, 'לא נדרשת חקירה נוספת');
  await checkStage(page);
  await page.getByRole('button', {name: 'למסמך הבא'}).click();
  await expect(page.getByRole('heading', {name: 'סיום החקירה'})).toBeVisible();
  await finishFromSecond(page, 'יש לבחון את התמונה המשולבת בלי לקבוע מראש כשל');
});

test('data table: tapping anywhere on a row selects it; each value shows its year on phones', async ({page}, testInfo) => {
  await start(page);
  const row = page.locator('.metrics-table tbody tr').filter({hasText: metricLabel('loans')});
  await row.locator('th').click();
  await expect(page.getByText('נבחרו 1 / 3')).toBeVisible();
  await expect(page.getByRole('button', {name: `בטל בדיקה של ${metricLabel('loans')}`})).toHaveAttribute('aria-pressed', 'true');
  // Nothing can be in the evidence drawer yet, so its button stays hidden on this screen.
  await expect(page.locator('.evidence-fab')).toHaveCount(0);
  if ((testInfo.project.use.viewport?.width ?? 0) <= 600) {
    const year = await row.locator('td.numeric').first().evaluate(el => getComputedStyle(el, '::before').content);
    expect(year).toBe(`"${scenario.columns[0]}"`);
    const box = await row.getByRole('button').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalScroll(page);
});
