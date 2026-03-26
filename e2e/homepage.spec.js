import { test, expect } from '@playwright/test';

test.describe('Главная страница', () => {
  test('должна загружаться успешно', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('должна иметь заголовок', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('должна отображать кнопку сброса', async ({ page }) => {
    await page.goto('/');
    const resetButton = page.locator('button:has-text("Сброс"), button:has-text("Reset"), #reset-btn');
    await expect(resetButton).toBeVisible();
  });
});
