import { expect, test } from "@playwright/test";

test("create room page renders UI-only room setup form", async ({ page }) => {
  await page.goto("/new");

  await expect(page.getByRole("heading", { name: "Create a room" })).toBeVisible();
  await expect(page.getByLabel("Room name")).toBeVisible();
  await expect(page.getByLabel("Your display name")).toBeVisible();
  await expect(page.getByLabel("Your display name")).toHaveAttribute("placeholder", "John");
  await expect(page.getByLabel("4 digit PIN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generate room" })).toBeVisible();
});

test("room page renders join form, invite code, and members", async ({ page }) => {
  await page.goto("/r/world-cup-room");

  await expect(page.getByRole("heading", { name: "Join World Cup Room" })).toBeVisible();
  await expect(page.getByLabel("Room code")).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveAttribute("placeholder", "John");
  await expect(page.getByLabel("4 digit PIN")).toHaveCount(0);
  await expect(page.getByText(/\/r\/world-cup-room\?invite=TIGER7/)).toBeVisible();
  await expect(page.getByLabel("Invite code")).toHaveText("TIGER7");
  await expect(page.getByRole("list", { name: "Room members" })).toBeVisible();
});

test("room join warns before claiming an existing player name", async ({ page }) => {
  await page.goto("/r/world-cup-room?invite=TIGER7&claimPlayerId=fallback-john&claimName=John%20Doe");

  await expect(page.getByLabel("Existing player found")).toBeVisible();
  await expect(page.getByRole("heading", { name: "John Doe is already in this room" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes, this is me" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Use another name" })).toHaveAttribute("href", "/r/world-cup-room?invite=TIGER7");
  await expect(page.getByLabel("Display name")).toBeVisible();
});

test("room page can render a room hub for returning players", async ({ page }) => {
  await page.goto("/r/world-cup-room?hub=1");

  await expect(page.getByText("World Cup Room · Room hub")).toBeVisible();
  await expect(page.getByRole("heading", { name: "World Cup Room" })).toBeVisible();
  await expect(page.locator(".hub-stats div").first().locator("b")).toHaveText("4");
  await expect(page.locator(".match-card.featured .sport-matchup")).toHaveAttribute("aria-label", "Netherlands vs Japan");
  await expect(page.locator(".match-card.featured .fixture-row")).toHaveCount(0);
  await expect(page.locator(".match-card.featured").getByText("15 Jun, 1:30 AM IST")).toBeVisible();
  await expect(page.locator(".match-card.featured").getByRole("link", { name: /Show prediction Netherlands vs Japan/i })).toBeVisible();
  await expect(page.getByText("Other open matches")).toBeVisible();
  await expect(page.getByRole("link", { name: /Predict Ivory Coast vs Ecuador/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Room score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /\/r\/world-cup-room\?invite=TIGER7/ })).toBeVisible();
  await expect(page.getByLabel("Invite code")).toHaveText("TIGER7");
});
