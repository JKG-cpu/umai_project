import { describe, test, expect, vi, beforeEach } from "vitest";

const mockRecognize = vi.hoisted(() => vi.fn());

vi.mock("tesseract.js", () => {
  const mod: any = vi.fn();
  mod.recognize = mockRecognize;
  return { default: mod, recognize: mockRecognize };
});

import { Jimp } from "jimp";
import { ocrReceipt } from "./ocr";

async function makeWhiteImage(): Promise<string> {
  const img = await Jimp.fromBitmap({
    width: 100,
    height: 50,
    data: Buffer.alloc(100 * 50 * 4, 255),
  });
  const buf = await img.getBuffer("image/png");
  return `data:image/png;base64,${buf.toString("base64")}`;
}

beforeEach(() => {
  mockRecognize.mockClear();
});

describe("ocrReceipt", () => {
  test("short-circuits when a pipeline hits high confidence", async () => {
    mockRecognize.mockResolvedValue({
      data: { text: "high conf result", confidence: 90 },
    });

    const b64 = await makeWhiteImage();
    const result = await ocrReceipt(b64);

    expect(result).toBe("high conf result");
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  test("returns the best result when no pipeline is high confidence", async () => {
    let callCount = 0;
    mockRecognize.mockImplementation(async () => {
      callCount++;
      return {
        data: {
          text: callCount === 1 ? "best text" : "worse text",
          confidence: callCount === 1 ? 80 : 60,
        },
      };
    });

    const b64 = await makeWhiteImage();
    const result = await ocrReceipt(b64);

    expect(result).toBe("best text");
  });

  test("returns empty string when all pipelines fail", async () => {
    mockRecognize.mockRejectedValue(new Error("OCR failed"));

    const b64 = await makeWhiteImage();
    const result = await ocrReceipt(b64);

    expect(result).toBe("");
  });

  test("returns empty string when all pipelines return zero confidence", async () => {
    mockRecognize.mockResolvedValue({
      data: { text: "", confidence: 0 },
    });

    const b64 = await makeWhiteImage();
    const result = await ocrReceipt(b64);

    expect(result).toBe("");
  });

  test("strips data URI prefix before processing", async () => {
    mockRecognize.mockResolvedValue({
      data: { text: "YOG", confidence: 90 },
    });

    const img = await Jimp.fromBitmap({
      width: 10,
      height: 10,
      data: Buffer.alloc(10 * 10 * 4, 255),
    });
    const buf = await img.getBuffer("image/png");
    const b64 = `data:image/jpeg;base64,${buf.toString("base64")}`;
    const result = await ocrReceipt(b64);

    expect(result).toBe("YOG");
  });
});
