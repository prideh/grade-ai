import { test, expect } from '@playwright/test';

test.describe('Smoke Tests — Critical Availability, Security Boundaries & Orthography', () => {
  test('1. Public landing, login, and register pages render 200 OK with strict Swiss German orthography (no Eszett)', async ({
    page,
  }) => {
    for (const route of ['/', '/login', '/register']) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('ß');
    }
  });

  test('2. Edge Proxy (proxy.ts) redirects unauthenticated requests on protected routes to /login', async ({
    page,
  }) => {
    for (const protectedRoute of ['/dashboard', '/classes', '/exams', '/submissions']) {
      await page.goto(protectedRoute);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('3. Protected API endpoints reject unauthenticated requests with HTTP 401', async ({
    request,
  }) => {
    const meRes = await request.get('/api/auth/me');
    expect(meRes.status()).toBe(401);

    const classesRes = await request.get('/api/classes');
    expect(classesRes.status()).toBe(401);

    const relayPostRes = await request.post('/api/mobile-relay', {
      data: { targetMode: 'SUBMISSION' },
    });
    expect(relayPostRes.status()).toBe(401);
  });

  test('4. Public Mobile QR Scanner route (/scan/[token]) is reachable without cookie auth and rejects invalid tokens', async ({
    page,
  }) => {
    const res = await page.goto('/scan/invalid-smoke-token');
    expect(res?.status()).toBe(200);
    await expect(
      page.getByText(/QR-Code ist abgelaufen oder ungültig|nicht verifiziert/i).first()
    ).toBeVisible();
  });
});
