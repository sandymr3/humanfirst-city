import { test, expect } from "@playwright/test";

// The app boots to the login screen. The walked flows — city → café → the nine
// questions — are in cafe-interview.spec.ts and need the dev auth bypass; this
// is the one that runs without it.
test("boots to the WarRoom login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CEO CITY" })).toBeVisible();
  await expect(page.getByText("Sign in with your WarRoom account")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter the city" })).toBeVisible();
});
