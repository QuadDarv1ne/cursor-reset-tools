import { test, expect } from '@playwright/test';

test.describe('API endpoints', () => {
  test('GET /api/stats должен возвращать статистику', async ({ request }) => {
    const response = await request.get('/api/stats');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success');
  });

  test('POST /api/reset должен принимать запрос', async ({ request }) => {
    const response = await request.post('/api/reset', {
      data: {}
    });
    expect([200, 400]).toContain(response.status());
  });

  test('GET /api/health должен возвращать статус', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
  });
});
