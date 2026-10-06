import type { APIRequestContext, Page } from "@playwright/test";

export interface TestAccount {
  usernameOrEmail: string;
  password: string;
  restaurantName: string;
}

/**
 * Creates a fresh restaurant + admin user via the real register endpoint, so every
 * test run starts from a clean slate instead of depending on seeded dev data.
 */
export async function registerTestAccount(request: APIRequestContext, apiBaseURL: string): Promise<TestAccount> {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const account: TestAccount = {
    usernameOrEmail: `e2e_${suffix}`,
    password: "Test1234!",
    restaurantName: `E2E Restaurant ${suffix}`,
  };

  const response = await request.post(`${apiBaseURL}/auth/register`, {
    data: {
      restaurantName: account.restaurantName,
      username: account.usernameOrEmail,
      email: `${account.usernameOrEmail}@example.test`,
      password: account.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`No se pudo registrar la cuenta de prueba: ${response.status()} ${await response.text()}`);
  }

  return account;
}

/**
 * Fills and submits the real login form. Works whether the page was just
 * navigated to /login (browser) or the app auto-redirected there on boot (Electron).
 */
export async function fillLoginForm(page: Page, account: TestAccount): Promise<void> {
  const usernameInput = page.locator("#usernameOrEmail");
  await usernameInput.waitFor({ state: "visible", timeout: 15_000 });
  await usernameInput.fill(account.usernameOrEmail);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}
