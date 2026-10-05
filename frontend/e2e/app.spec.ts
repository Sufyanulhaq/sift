import { expect, test } from "@playwright/test";

test("landing page leads to the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("customers");
  await page.getByRole("link", { name: "See the live demo" }).click();
  await expect(page).toHaveURL(/\/report\/sample$/);
  await expect(page.getByRole("heading", { name: "Topic map" })).toBeVisible();
});

test("demo report is interactive", async ({ page }) => {
  await page.goto("/report/sample");
  await expect(page.getByText("Pieces of feedback", { exact: true })).toBeVisible();

  // A citation opens the review it points to.
  const citation = page.getByRole("button", { name: /^R\d+$/ }).first();
  await citation.hover();
  await expect(page.getByText(/^Review \d+/)).toBeVisible();

  // Picking a topic filters the review list.
  const all = await page.getByText(/^[\d,]+ reviews$/).textContent();
  await page.getByLabel("Filter by topic").selectOption({ index: 1 });
  await expect(page.getByText(/^[\d,]+ reviews$/)).not.toHaveText(all ?? "");

  // Keyword search works without the server holding the job.
  await page.getByPlaceholder(/Try/).fill("refund");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(/matching “refund” by keywords/)).toBeVisible();
});

test("exports download", async ({ page }) => {
  await page.goto("/report/sample");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Reviews CSV" }).click()]);
  expect(file.suggestedFilename()).toMatch(/_reviews\.csv$/);
});

test("full analysis streams progress and saves the report", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.getByText("Server ready")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByText("Finding topics")).toBeVisible();
  await page.waitForURL(/\/report\/(?!sample)[\w-]+$/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Topic map" })).toBeVisible();

  // Meaning search runs on the server while it holds the job.
  await page.getByPlaceholder(/Try/).fill("refund taking forever");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(/matching “refund taking forever” by meaning/)).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("link", { name: /Hearth and oak reviews/i })).toBeVisible();
});

test("pasted text is analysed", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.getByText("Server ready")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Paste text" }).click();
  const lines = [
    "Delivery was two weeks late and nobody answered",
    "The courier lost my parcel",
    "Arrived late again, very annoying",
    "Great quality, really happy with it",
    "Lovely product, would buy again",
    "Fantastic build quality and finish",
    "Refund still not processed after a month",
    "Still waiting on my refund",
    "Customer service never replied to my refund request",
    "Packaging was damaged but the item was fine",
    "Assembly instructions were confusing",
    "Took ages to put together",
  ];
  await page.getByRole("textbox").fill(lines.join("\n"));
  await page.getByRole("button", { name: "Run analysis" }).click();
  await page.waitForURL(/\/report\/(?!sample)[\w-]+$/, { timeout: 45_000 });
  await expect(page.getByText("Pieces of feedback", { exact: true })).toBeVisible();
});

test("dark mode persists across pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.goto("/model");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "How Sift scores sentiment" })).toBeVisible();
});

test("no horizontal scroll on the report", async ({ page }) => {
  await page.goto("/report/sample");
  await expect(page.getByRole("heading", { name: "Topic map" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
