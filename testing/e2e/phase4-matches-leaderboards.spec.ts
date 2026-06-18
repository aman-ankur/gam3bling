import { expect, test } from "@playwright/test";

test("matches page prioritizes upcoming prediction locks", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches");

  await expect(page.getByRole("heading", { name: "Predictions lock soon" })).toBeVisible();
  await expect(page.getByText("Netherlands vs Japan")).toBeVisible();
  await expect(page.getByText("15 Jun, 1:30 AM IST")).toBeVisible();
  await expect(page.getByRole("link", { name: /View pick Netherlands vs Japan/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Predict Ivory Coast vs Ecuador/i })).toBeVisible();
  await expect(page.locator(".match-card").first().locator(".fixture-row")).toHaveCount(0);
  await expect(page.locator(".match-card").first().locator(".team-name").first()).toHaveAttribute("data-fifa-rank", "#7");
  await expect(page.getByText("Details cached")).toHaveCount(0);
  await expect(page.getByText("Fetch queued")).toHaveCount(0);
});

test("prediction page includes all MVP markets for an open fixture", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376");

  await expect(page.getByRole("heading", { name: "Netherlands vs Japan" })).toBeVisible();
  await expect(page.locator(".match-hero-score-card")).toBeVisible();
  await expect(page.locator(".match-hero-score-card").getByText("scheduled")).toHaveCount(0);
  await expect(page.locator(".match-score-refresh").getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(page.getByLabel("Netherlands flag").first()).toBeVisible();
  await expect(page.getByLabel("Japan flag").first()).toBeVisible();
  await expect(page.locator(".match-hero-score-card .center-lock b")).toHaveText("vs");
  await expect(page.getByRole("button", { name: "Compare" })).toBeVisible();
  await expect(page.getByText("Current WC points")).toBeHidden();
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Team comparison" })).toBeVisible();
  await expect(page.getByText("World ranking")).toBeVisible();
  await expect(page.getByLabel("Netherlands ranking value")).toHaveText("#7");
  await expect(page.getByLabel("Japan ranking value")).toHaveText("#18");
  await expect(page.getByText("Current WC points")).toBeVisible();
  await expect(page.getByText("World Cup record")).toBeVisible();
  await expect(page.getByText("World Cup best")).toBeVisible();
  await expect(page.getByText("Region")).toBeVisible();
  await page.getByRole("button", { name: "Predictions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Final score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Match result" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Half-time score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First team to score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Last team to score" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save predictions" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Predictions", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lineups" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stats" })).toBeVisible();
});

test("first-time prediction entry shows the form without friends predictions", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376");

  const saveButton = page.getByRole("button", { name: "Save predictions" });

  await expect(saveButton).toBeVisible();
  await expect(page.getByRole("heading", { name: "Friends' predictions" })).toHaveCount(0);
});

test("match page tabs show lineups and stats without exposing cache internals", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376");

  await page.getByRole("button", { name: "Lineups" }).click();
  await expect(page.getByRole("heading", { name: "Lineups" })).toBeVisible();
  await expect(page.getByLabel("Netherlands flag").first()).toBeVisible();
  await expect(page.getByText("4-2-3-1")).toBeVisible();
  await expect(page.getByText("Memphis Depay")).toBeVisible();

  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.getByRole("heading", { name: "Stats" })).toBeVisible();
  await expect(page.getByLabel("Japan flag").first()).toBeVisible();
  await expect(page.getByText("Ball Possession")).toBeVisible();
  await expect(page.getByText("Details cached")).toHaveCount(0);
  await expect(page.getByText("Fetch queued")).toHaveCount(0);
});

test("saved prediction page shows compact receipt before editable details", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376?saved=1");

  await expect(page.locator("header").getByRole("heading", { name: "FIFA World Cup 2026" })).toBeVisible();
  await expect(page.locator("header").getByText("World Cup Room")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to room" })).toHaveAttribute("href", "/r/world-cup-room?hub=1");
  const receipt = page.getByRole("region", { name: "Netherlands 2-1 Japan" });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("HT 1-0")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Friends' predictions" })).toBeVisible();
  await expect(page.locator(".pick-details")).toHaveCount(0);
  await expect(page.locator(".pick-card").first()).toHaveCSS("border-radius", "8px");
  await expect(page.getByText(/Netherlands win .* HT 1-0 .* First Netherlands .* Last Japan/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save predictions" })).toHaveCount(0);

  await page.getByText("Edit prediction").click();
  await expect(page.getByRole("button", { name: "Save predictions" })).toBeVisible();
});

test("prediction segmented choices visibly update when selected", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376");

  const firstScorer = page.locator("section", { has: page.getByRole("heading", { name: "First team to score" }) });
  const japanOption = firstScorer.locator("label", { hasText: "Japan" });
  await japanOption.click();
  await expect(japanOption).toHaveCSS("background-color", "rgb(216, 185, 93)");
});

test("prediction result and scorer options follow the final score", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376");

  const matchResult = page.locator("section", { has: page.getByRole("heading", { name: "Match result" }) });
  await expect(matchResult.locator("label", { hasText: "Netherlands" })).toHaveCSS("background-color", "rgb(216, 185, 93)");
  await expect(matchResult.getByText("Auto-selected from final score")).toBeVisible();

  await page.getByLabel("Netherlands final score").fill("1");
  await page.getByLabel("Japan final score").fill("1");
  await expect(matchResult.locator("label", { hasText: "Draw" })).toHaveCSS("background-color", "rgb(216, 185, 93)");

  await page.getByLabel("Netherlands final score").fill("0");
  await page.getByLabel("Japan final score").fill("2");
  await expect(matchResult.locator("label", { hasText: "Japan" })).toHaveCSS("background-color", "rgb(216, 185, 93)");
  await expect(page.getByLabel("Netherlands half-time score")).toHaveValue("0");
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "First team to score" }) }).locator("label", { hasText: "Netherlands" })).toHaveCSS("opacity", "0.58");
});

test("prediction page has a locked read-only state after kickoff", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489372");

  await expect(page.getByRole("heading", { name: "Haiti vs Scotland" })).toBeVisible();
  await expect(page.getByText("Prediction locked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save predictions" })).toBeDisabled();
});

test("room leaderboard shows ranked players", async ({ page }) => {
  await page.goto("/r/world-cup-room/leaderboard");

  await expect(page.locator("header").getByRole("heading", { name: "FIFA World Cup 2026" })).toBeVisible();
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
