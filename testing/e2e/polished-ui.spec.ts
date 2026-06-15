import { expect, test } from "@playwright/test";

const CORE_ROUTES = [
  "/",
  "/new",
  "/r/world-cup-room",
  "/r/world-cup-room?hub=1",
  "/r/world-cup-room/matches",
  "/r/world-cup-room/matches/1489376",
  "/r/world-cup-room/leaderboard",
  "/leaderboard",
  "/r/missing-room"
];

test("core pages use the polished dark match-room shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("header").getByRole("heading", { name: "Gam3bling" })).toBeVisible();
  await expect(page.getByText("FIFA World Cup 2026")).toBeVisible();
  await expect(page.locator(".app-frame")).toHaveCSS("background-color", "rgb(11, 15, 16)");
  await expect(page.locator(".hero-card").first()).toHaveCSS("background-color", "rgb(20, 26, 28)");
  await expect(page.locator(".hero-card").first()).toHaveCSS("border-radius", "8px");
  await expect(page.getByRole("link", { name: "Create room" })).toHaveCSS("background-color", "rgb(216, 185, 93)");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCSS("background-color", "rgba(11, 15, 16, 0.96)");

  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "Create a room" })).toBeVisible();
  await expect(page.locator(".form-card").first()).toHaveCSS("background-color", "rgb(20, 26, 28)");
  await expect(page.locator(".form-card").first()).toHaveCSS("border-radius", "8px");
  await expect(page.getByRole("button", { name: "Generate room" })).toHaveCSS("background-color", "rgb(216, 185, 93)");

  await page.goto("/r/world-cup-room?hub=1");
  await expect(page.locator("header").getByRole("heading", { name: "FIFA World Cup 2026" })).toBeVisible();
  await expect(page.locator("header").getByText("World Cup Room")).toHaveCount(0);
  await expect(page.locator(".room-hub-hero").getByRole("heading", { name: "World Cup Room" })).toBeVisible();
  await expect(page.locator(".match-card").first()).toHaveCSS("background-color", "rgb(20, 26, 28)");
  await expect(page.locator(".match-card").first()).toHaveCSS("border-radius", "8px");
  await expect(page.locator(".room-hub-hero h1")).toHaveCSS("font-size", "32px");
  await expect(page.locator(".section-heading h2").first()).toHaveCSS("font-size", "18px");
  await expect(page.locator(".sport-card .center-lock b").first()).toHaveCSS("font-size", "26px");
  await expect(page.locator(".bottom-nav a").first()).toHaveCSS("font-size", "12px");
});

test("room hub other open matches show country names beside flags", async ({ page }) => {
  await page.goto("/r/world-cup-room?hub=1");

  const firstFixture = page.locator(".other-open-match-row").first();

  await expect(firstFixture.getByText("Ivory Coast")).toBeVisible();
  await expect(firstFixture.getByText("Ecuador")).toBeVisible();

  const labelWidths = await firstFixture.locator(".team-name > span:last-child").evaluateAll((labels) =>
    labels.map((label) => Math.round(label.getBoundingClientRect().width))
  );

  expect(labelWidths).toEqual(expect.arrayContaining([expect.any(Number), expect.any(Number)]));
  expect(Math.min(...labelWidths)).toBeGreaterThan(42);
});

test("match prediction page uses the studio treatment across tabs", async ({ page }) => {
  await page.goto("/r/world-cup-room/matches/1489376");

  await expect(page.getByRole("heading", { name: "Netherlands vs Japan" })).toBeVisible();
  await expect(page.locator(".match-tab-list")).toHaveCSS("background-color", "rgba(255, 255, 255, 0.06)");
  await expect(page.locator(".match-tab-list")).toHaveCSS("border-radius", "8px");
  await expect(page.locator(".market-card").first()).toHaveCSS("background-color", "rgb(20, 26, 28)");
  await expect(page.locator(".market-card").first()).toHaveCSS("border-radius", "8px");
  await expect(page.getByRole("button", { name: "Save predictions" })).toHaveCSS("background-color", "rgb(216, 185, 93)");

  await page.getByRole("button", { name: "Lineups" }).click();
  await expect(page.locator(".football-pitch")).toHaveCSS("border-radius", "8px");

  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.locator(".match-detail-panel").first()).toHaveCSS("background-color", "rgb(20, 26, 28)");
  await expect(page.locator(".match-detail-panel").first()).toHaveCSS("border-radius", "8px");
});

test("mobile routes do not clip content horizontally", async ({ page }) => {
  for (const route of CORE_ROUTES) {
    await page.goto(route);

    await expect(page.locator(".app-frame")).toBeVisible();

    const overflow = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const offenders = Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();

          return {
            className: element.getAttribute("class") ?? "",
            tagName: element.tagName,
            text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
            left: Math.floor(rect.left),
            right: Math.ceil(rect.right),
            width: Math.ceil(rect.width)
          };
        })
        .filter((rect) => rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1));

      return {
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        offenders,
        viewportWidth
      };
    });

    expect(overflow, route).toEqual({
      bodyScrollWidth: overflow.viewportWidth,
      documentScrollWidth: overflow.viewportWidth,
      offenders: [],
      viewportWidth: overflow.viewportWidth
    });
  }
});
