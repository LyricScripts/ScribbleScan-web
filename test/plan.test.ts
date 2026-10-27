import { afterEach, describe, expect, it, vi } from "vitest";
import { api, session } from "../src/api/client";
import { onUpgradeAsked, planFeatures, type UpgradeRequired } from "../src/plan";

afterEach(() => vi.unstubAllGlobals());

describe("upgrade prompt", () => {
  it("opens on a 402 and still throws the API's message", async () => {
    session.token = "t";
    const detail = {
      code: "upgrade_required",
      feature: "export_formats",
      plan: "plus",
      message: "Excel export comes with Plus.",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail }, { status: 402 })),
    );
    const asked: UpgradeRequired[] = [];
    const stop = onUpgradeAsked((d) => asked.push(d));

    await expect(api("/v1/spaces/s/export")).rejects.toThrow("Excel export comes with Plus.");
    expect(asked).toEqual([detail]);
    stop();
  });

  it("stays closed for other errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "no such space" }, { status: 404 })),
    );
    const asked: UpgradeRequired[] = [];
    const stop = onUpgradeAsked((d) => asked.push(d));
    await expect(api("/v1/spaces/x")).rejects.toThrow("no such space");
    expect(asked).toEqual([]);
    stop();
  });
});

describe("planFeatures", () => {
  it("describes what a plan adds", () => {
    expect(
      planFeatures({
        name: "business",
        scans_per_month: 500,
        business_spaces: 1,
        budget_categories: null,
        doc_types: ["bank_statement", "invoice", "receipt"],
        export_formats: ["csv", "xlsx"],
        price_monthly: 499,
        price_yearly: 4999,
      }),
    ).toEqual([
      "500 automatic scans a month",
      "Personal + 1 business space",
      "Budgets for every category",
      "Receipts, invoices and bank statements",
      "CSV and Excel export",
    ]);
  });
});
