import { expect, test } from "./fixtures";
import { fillLoginForm, registerTestAccount } from "../fixtures/auth";

const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:3000";

test("la app de escritorio inicia y permite loguearse", async ({ page, request }) => {
  const account = await registerTestAccount(request, API_URL);

  await fillLoginForm(page, account);

  await expect(page).not.toHaveURL(/\/login/);
});
