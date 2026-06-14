import { describe, test, expect } from "vitest";
import { filterItemTokens } from "./token-filter";

describe("filterItemTokens", () => {
  test("extracts item-like tokens from full receipt text", () => {
    const text = [
      "LIDL",
      "Via Roma 10",
      "YOG 2x 1.49",
      "MOZZAR 1x 2.99",
      "LATTE 2x 3.49",
      "PANE 1x 1.00",
      "TOTAL 8.97",
      "VISA 1234",
    ].join("\n");

    const tokens = filterItemTokens(text);
    expect(tokens).toContain("YOG");
    expect(tokens).toContain("MOZZAR");
    expect(tokens).toContain("LATTE");
    expect(tokens).toContain("PANE");
    expect(tokens).not.toContain("TOTAL");
    expect(tokens).not.toContain("VISA");
    expect(tokens).not.toContain("2x");
    expect(tokens).not.toContain("1x");
    expect(tokens).not.toContain("1.49");
  });

  test("filters out prices", () => {
    const tokens = filterItemTokens("YOG $1.49 MOZZAR €2,99");
    expect(tokens).toEqual(["YOG", "MOZZAR"]);
  });

  test("filters out dates and times", () => {
    const tokens = filterItemTokens("2024-01-15 14:30 YOG");
    expect(tokens).toEqual(["YOG"]);
  });

  test("filters out known skip words", () => {
    const text = "TOTAL SUBTOTAL TAX VAT CASH CHANGE THANK YOU YOG".toUpperCase();
    const tokens = filterItemTokens(text);
    expect(tokens).toEqual(["YOG"]);
  });

  test("filters out Italian skip words", () => {
    const text = "IVA TOTALE SCONTO CONTANTI YOG MOZZAR";
    const tokens = filterItemTokens(text);
    expect(tokens).toEqual(["YOG", "MOZZAR"]);
  });

  test("deduplicates tokens", () => {
    const tokens = filterItemTokens("YOG YOG MOZZAR YOG");
    expect(tokens).toEqual(["YOG", "MOZZAR"]);
  });

  test("returns empty array for non-item text", () => {
    const tokens = filterItemTokens("TOTAL $100.00 2024-01-15 14:30");
    expect(tokens).toEqual([]);
  });

  test("filters out short tokens (< 2 chars)", () => {
    const tokens = filterItemTokens("A B C YOG");
    expect(tokens).toEqual(["YOG"]);
  });

  test("keeps uppercase abbreviations 6-12 chars", () => {
    const tokens = filterItemTokens("YOGURT MOZZARELLA PANE");
    expect(tokens).toEqual(["YOGURT", "MOZZARELLA", "PANE"]);
  });

  test("handles mixed case tokens", () => {
    const tokens = filterItemTokens("Yog Mozzar PanE");
    expect(tokens).toEqual(["YOG", "MOZZAR", "PANE"]);
  });
});
