import { expect, test } from "@playwright/test";

test("matches page prioritizes upcoming prediction locks", async ({ page }) => {
  await page.goto("/r/goa-wc-chaos/matches");

  await expect(page.getByRole("heading", { name: "Predictions lock soon" })).toBeVisible();
  await expect(page.getByText("Netherlands vs Japan")).toBeVisible();
  await expect(page.getByText("15 Jun, 1:30 AM IST")).toBeVisible();
  await expect(page.getByRole("link", { name: /Predict Netherlands vs Japan/i })).toBeVisible();
});

test("prediction page includes all MVP markets for an open fixture", async ({ page }) => {
  await page.goto("/r/goa-wc-chaos/matches/1489376");

  await expect(page.getByRole("heading", { name: "Netherlands vs Japan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Match result" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Half-time score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First team to score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Last team to score" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save predictions" })).toBeEnabled();
});

test("saved prediction page shows compact receipt before editable details", async ({ page }) => {
  await page.goto("/r/goa-wc-chaos/matches/1489376?saved=1");

  await expect(page.getByText("Netherlands 2-1 Japan")).toBeVisible();
  await expect(page.getByText("HT 1-0")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Friends' predictions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save predictions" })).toHaveCount(0);

  await page.getByText("Edit prediction").click();
  await expect(page.getByRole("button", { name: "Save predictions" })).toBeVisible();
});

test("prediction segmented choices visibly update when selected", async ({ page }) => {
  await page.goto("/r/goa-wc-chaos/matches/1489376");

  const firstScorer = page.locator("section", { has: page.getByRole("heading", { name: "First team to score" }) });
  const japanOption = firstScorer.locator("label", { hasText: "Japan" });
  await japanOption.click();
  await expect(japanOption).toHaveCSS("background-color", "rgb(232, 197, 106)");
});

test("prediction result and scorer options follow the final score", async ({ page }) => {
  await page.goto("/r/goa-wc-chaos/matches/1489376");

  const matchResult = page.locator("section", { has: page.getByRole("heading", { name: "Match result" }) });
  await expect(matchResult.locator("label", { hasText: "Netherlands" })).toHaveCSS("background-color", "rgb(232, 197, 106)");
  await expect(matchResult.getByText("Auto-selected from final score")).toBeVisible();

  await page.getByLabel("Netherlands final score").fill("1");
  await page.getByLabel("Japan final score").fill("1");
  await expect(matchResult.locator("label", { hasText: "Draw" })).toHaveCSS("background-color", "rgb(232, 197, 106)");

  await page.getByLabel("Netherlands final score").fill("0");
  await page.getByLabel("Japan final score").fill("2");
  await expect(matchResult.locator("label", { hasText: "Japan" })).toHaveCSS("background-color", "rgb(232, 197, 106)");
  await expect(page.getByLabel("Netherlands half-time score")).toHaveValue("0");
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "First team to score" }) }).locator("label", { hasText: "Netherlands" })).toHaveCSS("opacity", "0.58");
});

test("prediction page has a locked read-only state after kickoff", async ({ page }) => {
  await page.goto("/r/goa-wc-chaos/matches/1489372");

  await expect(page.getByRole("heading", { name: "Haiti vs Scotland" })).toBeVisible();
  await expect(page.getByText("Prediction locked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save predictions" })).toBeDisabled();
});

test("room leaderboard shows ranked players", async ({ page }) => {
  await page.goto("/r/goa-wc-chaos/leaderboard");

  await expect(page.getByRole("heading", { name: "Room leaderboard" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Room leaderboard rankings" })).toBeVisible();
  await expect(page.getByText("John Doe")).toBeVisible();
  await expect(page.getByText("48 pts")).toBeVisible();
});

test("global leaderboard shows cross-room ranking", async ({ page }) => {
  await page.goto("/leaderboard");

  await expect(page.getByRole("heading", { name: "Global leaderboard" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Global leaderboard rankings" })).toBeVisible();
  await expect(page.getByText("Jane Doe")).toBeVisible();
});
