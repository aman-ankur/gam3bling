import { expect, test } from "@playwright/test";

test("core pages use the polished Stadium Glass shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Gam3Bling" })).toBeVisible();
  await expect(page.locator(".app-frame")).toHaveCSS("background-color", "rgb(243, 241, 246)");
  await expect(page.locator(".hero-card").first()).toHaveCSS("border-radius", "24px");
  await expect(page.getByRole("link", { name: "Create room" })).toHaveCSS("background-color", "rgb(104, 70, 189)");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCSS("border-radius", "24px");

  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "Create a room" })).toBeVisible();
  await expect(page.locator(".form-card").first()).toHaveCSS("border-radius", "24px");
  await expect(page.getByRole("button", { name: "Generate room" })).toHaveCSS("background-color", "rgb(104, 70, 189)");

  await page.goto("/r/world-cup-room?hub=1");
  await expect(page.getByRole("heading", { name: "Room hub" })).toBeVisible();
  await expect(page.locator(".match-card").first()).toHaveCSS("border-radius", "24px");
});

test("match prediction page uses the studio treatment across tabs", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376");

  await expect(page.getByRole("heading", { name: "Netherlands vs Japan" })).toBeVisible();
  await expect(page.locator(".match-tab-list")).toHaveCSS("border-radius", "999px");
  await expect(page.locator(".market-card").first()).toHaveCSS("border-radius", "24px");
  await expect(page.getByRole("button", { name: "Save predictions" })).toHaveCSS("background-color", "rgb(104, 70, 189)");

  await page.getByRole("button", { name: "Lineups" }).click();
  await expect(page.locator(".football-pitch")).toHaveCSS("border-radius", "24px");

  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.locator(".match-detail-panel").first()).toHaveCSS("border-radius", "24px");
});
