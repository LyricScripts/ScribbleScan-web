import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  clearTokens: vi.fn(),
  request: vi.fn(),
  useDemo: vi.fn(),
  upload: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/src/api/client", () => ({
  api: mocks.api,
  clearTokens: mocks.clearTokens,
  request: mocks.request,
}));
vi.mock("@/src/components/demo-context", () => ({ useDemo: mocks.useDemo }));

import { ReceiptUploadDialog } from "@/src/components/receipt-upload-dialog";

const receiptData = {
  shop_name: "Shwapno Super Shop",
  receipt_date: "2026-10-05",
  currency: "BDT",
  line_items: [{ description: "Rice", quantity: 2, unit_price: 50, discount: 0, amount: 100 }],
  subtotal: 100,
  discount: 0,
  vat: 0,
  total: 1250,
  payment_method: "bkash",
};

const receiptSchema = {
  properties: {
    shop_name: { "x-kind": "text" },
    receipt_date: { "x-kind": "date" },
    currency: { "x-kind": "code" },
    line_items: {
      "x-kind": "rows",
      items: { properties: {
        description: { "x-kind": "text" }, quantity: { "x-kind": "number" },
        unit_price: { "x-kind": "amount" }, discount: { "x-kind": "amount" }, amount: { "x-kind": "amount" },
      } },
    },
    subtotal: { "x-kind": "amount" },
    discount: { "x-kind": "amount" },
    vat: { "x-kind": "amount" },
    total: { "x-kind": "amount" },
    payment_method: { "x-kind": "code" },
  },
};

function documentOut(status: "processing" | "needs_review" | "ready" = "needs_review") {
  return {
    id: "doc-1",
    space_id: "space-1",
    status,
    doc_type: "receipt",
    filename: "receipt.png",
    merchant: "Shwapno Super Shop",
    total: 1250,
    date: "2026-10-05",
    category: "groceries",
    data: receiptData,
    issues: [],
    error: null,
    uploaded_via_phone: false,
    created_at: "2026-10-22T00:00:00Z",
    possible_duplicate_of: null,
  };
}

let host: HTMLDivElement;
let root: Root;

async function renderDialog(onClose = vi.fn()) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(createElement(ReceiptUploadDialog, { open: true, onClose }));
  });
  return onClose;
}

async function chooseReceipt(file = new File(["receipt"], "receipt.png", { type: "image/png" })) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Receipt file input is missing");
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:receipt") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  mocks.useDemo.mockReturnValue({
    activeSpace: "Personal",
    activeSpaceId: "space-1",
    source: "connected",
    upload: mocks.upload,
    refresh: mocks.refresh,
  });
  mocks.request.mockResolvedValue({ ok: true, blob: async () => new Blob(["receipt"], { type: "image/png" }) });
  mocks.refresh.mockResolvedValue(undefined);
  mocks.api.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    if (options?.method === "PATCH") return { ...documentOut("ready"), ...(options.body as object) };
    if (options?.method === "DELETE") return null;
    if (path === "/v1/categories") return ["groceries", "other"];
    if (path === "/v1/schemas/receipt") return receiptSchema;
    if (path === "/v1/documents/doc-1") return documentOut("needs_review");
    throw new Error(`Unexpected API request: ${path}`);
  });
  mocks.upload.mockResolvedValue(documentOut());
});

afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
});

describe("receipt upload dialog", () => {
  it("uploads the selected image, shows editable extracted values, saves, and closes", async () => {
    const onClose = await renderDialog();
    const file = new File(["receipt"], "receipt.png", { type: "image/png" });

    await chooseReceipt(file);

    expect(mocks.upload).toHaveBeenCalledWith("space-1", file);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Details read from receipt");
    expect(host.textContent).toContain("Line items");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Description"]')?.value).toBe("Rice");
    expect(host.querySelector<HTMLImageElement>('img[alt="Uploaded receipt"]')?.src).toBe("blob:receipt");

    const shopName = host.querySelector<HTMLInputElement>("#receipt-field-shop_name");
    expect(shopName?.value).toBe("Shwapno Super Shop");
    if (!shopName) throw new Error("Extracted shop name field is missing");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(shopName, "Corrected shop name");
    await act(async () => {
      shopName.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const save = [...host.querySelectorAll("button")].find((button) => button.textContent === "Save");
    expect(save).toBeTruthy();
    await act(async () => save?.click());

    const patchCall = mocks.api.mock.calls.find(([, options]) => (options as { method?: string } | undefined)?.method === "PATCH");
    expect((patchCall?.[1] as { body: { confirmed: boolean; data: { shop_name: string } } }).body).toMatchObject({
      confirmed: true,
      data: { shop_name: "Corrected shop name" },
    });
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.api.mock.calls.some(([, options]) => (options as { method?: string } | undefined)?.method === "DELETE")).toBe(false);
  });

  it("deletes an unfinished uploaded receipt when the user cancels", async () => {
    const onClose = await renderDialog();
    await chooseReceipt();

    const cancel = [...host.querySelectorAll("button")].find((button) => button.textContent === "Cancel");
    expect(cancel).toBeTruthy();
    await act(async () => cancel?.click());

    expect(mocks.api).toHaveBeenCalledWith("/v1/documents/doc-1", { method: "DELETE" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows an animated wait state while extraction is still processing", async () => {
    mocks.upload.mockResolvedValue(documentOut("processing"));
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/v1/categories") return ["groceries", "other"];
      if (path === "/v1/schemas/receipt") return receiptSchema;
      if (path === "/v1/documents/doc-1") return documentOut("processing");
      throw new Error(`Unexpected API request: ${path}`);
    });
    await renderDialog();

    await chooseReceipt();

    expect(host.textContent).toContain("Reading receipt details");
    expect(host.textContent).toContain("AI is reading your receipt. This can take a little while");
    expect(host.querySelector(".animate-spin")).toBeTruthy();
  });
});
