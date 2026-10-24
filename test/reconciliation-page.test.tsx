import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn(), useDemo: vi.fn() }));
vi.mock("@/src/api/client", () => ({ api: mocks.api }));
vi.mock("@/src/components/demo-context", () => ({ useDemo: mocks.useDemo }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: unknown }) => createElement("a", { href, ...props }, children) }));

import ReconciliationPage from "@/app/reconciliation/page";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mocks.useDemo.mockReturnValue({ activeSpace: "Shop", activeSpaceId: "space-1", currency: "BDT", source: "connected" });
  mocks.api.mockResolvedValue({
    statements: [{
      id: "statement-1", filename: "October.pdf", period_start: "2026-10-01", period_end: "2026-10-31", currency: "BDT",
      transactions: [{
        transaction_index: 0, date: "2026-10-22", description: "DSS withdrawal", debit: 200, status: "suggested",
        suggested_document_id: "receipt-1", candidates: [{
          document_id: "receipt-1", merchant: "DSS Daily Super Shop", total: 200, date: "2026-10-21", day_delta: 1,
          description_match: true,
        }],
      }],
    }],
    unmatched_receipts: [],
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("reconciliation page", () => {
  it("shows a statement withdrawal and links its receipt suggestion for review", async () => {
    await act(async () => {
      root.render(createElement(ReconciliationPage));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.api).toHaveBeenCalledWith("/v1/spaces/space-1/reconciliation");
    expect(host.textContent).toContain("Review suggestion");
    expect(host.textContent).toContain("DSS Daily Super Shop");
    expect(host.textContent).toContain("Suggested matches");
    expect(host.querySelector('a[href="/receipts/receipt-1"]')?.textContent).toContain("DSS Daily Super Shop");
  });
});
