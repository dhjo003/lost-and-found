import { test, expect } from '@playwright/test';
import { createTestUser } from './setup/createTestUser.js';
import path from 'path';
import { fileURLToPath } from 'url';

test('login -> create item -> upload image -> view item', async ({ page }) => {
  const setup = await createTestUser();
  const { token, user } = setup;

  // inject auth before the app loads
  await page.addInitScript(value => {
    localStorage.setItem('app_jwt', value.token);
    localStorage.setItem('lf_user', JSON.stringify(value.user));
  }, { token, user });

  await page.goto('http://localhost:5173/items/new');

  // wait for lookup dropdowns to populate
  await page.waitForSelector('select');

  // pick first non-empty option for Item Type
  // pick first non-empty option for Item Type — support both native <select> and custom combobox implementations
  // Try native select first
  const hasNativeSelect = await page.$('select') !== null;
  if (hasNativeSelect) {
    const typeValue = await page.evaluate(() => {
      const sel = document.querySelector('select');
      return sel && sel.options && sel.options.length > 1 ? sel.options[1].value : '';
    });
    if (typeValue) await page.selectOption('select', typeValue);
  } else {
    // fallback: handle ARIA combobox / custom dropdowns
    const combo = page.getByRole('combobox', { name: /Item Type/i }).first();
    if (await combo.count() > 0) {
      await combo.click();
      // wait for options to appear
      const options = page.getByRole('option');
      await options.first().waitFor({ timeout: 5000 }).catch(() => {});
      const n = await options.count();
      for (let i = 0; i < n; i++) {
        const opt = options.nth(i);
        const txt = (await opt.innerText()).trim();
        if (!/select/i.test(txt) && txt.length > 0) {
          await opt.click();
          break;
        }
      }
    }
  }

  // fill item name
  await page.fill('input[required]:not([type="datetime-local"])', 'Playwright Test Item');

  // upload an image (fixture)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const imgPath = path.join(__dirname, 'fixtures', 'test-image.png');
  await page.setInputFiles('input[type="file"]', imgPath);

  // submit form — target the form submit button specifically to avoid matching nav links
  await page.waitForSelector('button:has-text("Create Item")', { timeout: 10000 });
  await page.locator('button:has-text("Create Item")').first().click();

  // wait for navigation to item detail page and verify name visible
  await page.waitForURL(/\/items\//);
  await expect(page.locator('text=Playwright Test Item')).toBeVisible({ timeout: 15000 });
});
