import { expect, test } from "@playwright/test";
import { fillLoginForm, registerTestAccount } from "../fixtures/auth";

const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:3000";

test("un usuario recién registrado puede loguearse", async ({ page, request }) => {
  const account = await registerTestAccount(request, API_URL);

  await page.goto("/login");
  await fillLoginForm(page, account);

  await expect(page).not.toHaveURL(/\/login/);
});

test("la sección de pedidos carga sin errores", async ({ page, request }) => {
  // /orders es un módulo CORE, sin gate — a diferencia de /salon, que requiere
  // activar el módulo SALON (fuera del alcance de este smoke test).
  const account = await registerTestAccount(request, API_URL);

  await page.goto("/login");
  await fillLoginForm(page, account);

  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
});
