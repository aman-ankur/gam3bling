import { expect, test } from "@playwright/test";

test("home page renders the Gam3bling shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("header").getByRole("heading", { name: "Gam3bling" })).toBeVisible();
  await expect(page.getByText("FIFA World Cup 2026")).toBeVisible();
  await expect(page.getByText("World Cup prediction rooms")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create room" })).toHaveAttribute("href", "/new");
  await expect(page.getByRole("link", { name: "Join demo room" })).toHaveCount(0);
  await expect(page.getByText("Max 29 pts")).toBeVisible();
  await expect(page.getByRole("link", { name: "Matches" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Picks" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\bpicks?\b/i);
});

test("home page offers direct room joining by code", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Join a room" })).toBeVisible();
  await expect(page.getByLabel("Room code")).toBeVisible();
  await expect(page.getByLabel("Your display name")).toBeVisible();
  await expect(page.getByLabel("Your display name")).toHaveAttribute("placeholder", "John");
  await expect(page.getByLabel("4 digit PIN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Join room" })).toBeVisible();
});

test("home page shows a returning room shortcut", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Your rooms" })).toBeVisible();
  await expect(page.getByRole("link", { name: /World Cup Room/i })).toHaveAttribute("href", "/r/world-cup-room");
  await expect(page.getByText("Netherlands vs Japan")).toBeVisible();
});

test("primary navigation stays pinned to the bottom of the viewport", async ({ page }) => {
  await page.goto("/");

  const position = await page.getByRole("navigation", { name: "Primary" }).evaluate((element) => {
    return window.getComputedStyle(element).position;
  });

  expect(position).toBe("fixed");
});
