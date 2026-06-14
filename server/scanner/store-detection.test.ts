import { describe, test, expect } from "vitest";
import { detectStore } from "./store-detection";

describe("detectStore", () => {
  test("returns null for empty input", () => {
    const result = detectStore([]);
    expect(result.storeId).toBeNull();
    expect(result.chain).toBeNull();
  });

  test("detects Lidl from first line", () => {
    const lines = ["LIDL", "Via Roma 10", "00100 Roma"];
    const result = detectStore(lines);
    expect(result.storeId).toBe("lidl-de");
    expect(result.chain).toBe("lidl");
    expect(result.locale).toBe("de");
  });

  test("detects Lidl from lowercase header", () => {
    const lines = ["lidl italia", "Via Milano 5"];
    const result = detectStore(lines);
    expect(result.storeId).toBe("lidl-de");
    expect(result.chain).toBe("lidl");
  });

  test("detects Walmart from header", () => {
    const lines = ["WALMART", "123 Main St", "Springfield, US"];
    const result = detectStore(lines);
    expect(result.storeId).toBe("walmart-us");
    expect(result.chain).toBe("walmart");
    expect(result.locale).toBe("us");
  });

  test("detects Esselunga", () => {
    const lines = ["ESSELUNGA", "Via Torino 22"];
    const result = detectStore(lines);
    expect(result.storeId).toBe("esselunga-it");
    expect(result.chain).toBe("esselunga");
    expect(result.locale).toBe("it");
  });

  test("detects Carrefour", () => {
    const lines = ["CARREFOUR EXPRESS", "Rue de Paris 15"];
    const result = detectStore(lines);
    expect(result.storeId).toBe("carrefour-fr");
    expect(result.chain).toBe("carrefour");
  });

  test("returns null for unknown store", () => {
    const lines = ["MY LOCAL MARKET", "Some Street 1"];
    const result = detectStore(lines);
    expect(result.storeId).toBeNull();
    expect(result.chain).toBeNull();
    expect(result.locale).toBe("us");
  });

  test("detects store from lower lines in header", () => {
    const lines = [
      "TAX INVOICE",
      "Date: 2024-01-15",
      "COOP",
      "QTY ITEM PRICE",
      "1 YOG 1.49",
    ];
    const result = detectStore(lines);
    expect(result.storeId).toBe("coop-it");
    expect(result.chain).toBe("coop");
  });
});
