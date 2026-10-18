import { beforeEach, describe, expect, it } from "vitest";
import { newPage } from "../src/views/shared";

describe("newPage", () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="view"></main>';
  });
  const shown = () => document.getElementById("view")?.textContent;

  it("drops a slow page that finishes after a newer one", async () => {
    // The user opens October, then quickly November; October's data arrives last.
    const october = newPage();
    const november = newPage();
    november.render("November");
    await Promise.resolve();
    october.render("October");
    expect(shown()).toBe("November");
    expect(october.current).toBe(false);
    expect(november.current).toBe(true);
  });

  it("lets the newest page render again later (e.g. after saving)", () => {
    const page = newPage();
    page.render("first");
    page.render("second");
    expect(shown()).toBe("second");
  });
});
