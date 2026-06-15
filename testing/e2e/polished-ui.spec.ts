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

test("core pages use the polished Stadium Glass shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("header").getByRole("heading", { name: "Gam3bling" })).toBeVisible();
  await expect(page.getByText("FIFA World Cup 2026")).toBeVisible();
  await expect(page.locator(".app-frame")).toHaveCSS("background-color", "rgb(243, 241, 246)");
  await expect(page.locator(".hero-card").first()).toHaveCSS("border-radius", "24px");
  await expect(page.getByRole("link", { name: "Create room" })).toHaveCSS("background-color", "rgb(104, 70, 189)");
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCSS("border-radius", "24px");

  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "Create a room" })).toBeVisible();
  await expect(page.locator(".form-card").first()).toHaveCSS("border-radius", "24px");
  await expect(page.getByRole("button", { name: "Generate room" })).toHaveCSS("background-color", "rgb(104, 70, 189)");

  await page.goto("/r/world-cup-room?hub=1");
  await expect(page.getByText("World Cup Room · Room hub")).toBeVisible();
  await expect(page.getByRole("heading", { name: "World Cup Room" })).toBeVisible();
  await expect(page.locator(".match-card").first()).toHaveCSS("border-radius", "24px");
});

test("room hub fixture rows show country names beside flags", async ({ page }) => {
  await page.goto("/r/world-cup-room?hub=1");

  const firstFixture = page.locator(".match-card .fixture-row").first();

  await expect(firstFixture.getByText("Netherlands")).toBeVisible();
  await expect(firstFixture.getByText("Japan")).toBeVisible();

  const labelWidths = await firstFixture.locator(".team-name > span:last-child").evaluateAll((labels) =>
    labels.map((label) => Math.round(label.getBoundingClientRect().width))
  );

  expect(labelWidths).toEqual(expect.arrayContaining([expect.any(Number), expect.any(Number)]));
  expect(Math.min(...labelWidths)).toBeGreaterThan(42);
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
