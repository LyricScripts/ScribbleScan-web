import { describe, expect, it } from "vitest";
import { money, parseAmount, shiftMonth, thisMonth, toDMY, toISO } from "../src/format";

describe("money", () => {
  it("groups by lakh and crore, with the taka sign", () => {
    expect(money(125000, "BDT")).toBe("৳1,25,000");
    expect(money(12345678.5, "BDT")).toBe("৳1,23,45,678.5");
  });
  it("shows a dash when there is no amount", () => {
    expect(money(null, "BDT")).toBe("—");
  });
  it("can leave the sign out, and falls back to the code for unknown currencies", () => {
    expect(money(1250, "BDT", { sign: false })).toBe("1,250");
    expect(money(10, "JPY")).toBe("JPY 10");
  });
});

describe("parseAmount reads what people type", () => {
  it.each([
    ["৳১,২৫০", 1250],
    ["1,250 Tk", 1250],
    ["1250/-", 1250],
    ["BDT 99.50", 99.5],
  ])("%s -> %s", (typed, n) => expect(parseAmount(typed)).toBe(n));
  it("keeps unreadable input as text, so the API can flag it", () => {
    expect(parseAmount("about 500")).toBe("about 500");
  });
});

describe("day-first dates", () => {
  it("converts both ways", () => {
    expect(toDMY("2026-10-05")).toBe("05/10/2026");
    expect(toISO("5/10/2026")).toBe("2026-10-05");
    expect(toISO("05.10.2026")).toBe("2026-10-05");
  });
  it("leaves anything else alone", () => {
    expect(toISO("next week")).toBe("next week");
  });
});

describe("months", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("uses the local clock, not UTC", () => {
    // 00:30 on 1 November in Dhaka is still October in UTC; the app must say November.
    expect(thisMonth(new Date(2026, 10, 1, 0, 30))).toBe("2026-11");
  });
});
