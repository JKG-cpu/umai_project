import { Jimp } from "jimp";
import Tesseract from "tesseract.js";

const HIGH_CONFIDENCE = 85;

type Pipeline = {
  name: string;
  process: (buffer: Buffer) => Promise<Buffer>;
};

function stripDataUri(b64: string): string {
  const idx = b64.indexOf(",");
  return idx !== -1 ? b64.slice(idx + 1) : b64;
}

function bufferFromBase64(b64: string): Buffer {
  const raw = stripDataUri(b64);
  return Buffer.from(raw, "base64");
}

async function processPipeline(
  buffer: Buffer,
  fn: (img: any) => Promise<void> | void
): Promise<Buffer> {
  const img = await Jimp.read(buffer);
  await fn(img);
  return img.getBuffer("image/png");
}

const pipelines: Pipeline[] = [
  {
    name: "original",
    process: async (buf) => buf,
  },
  {
    name: "grayscale+contrast",
    process: (buf) =>
      processPipeline(buf, (img) => {
        img.greyscale();
        img.contrast(0.5);
      }),
  },
  {
    name: "binarize",
    process: (buf) =>
      processPipeline(buf, (img) => {
        img.greyscale();
        img.contrast(1);
      }),
  },
  {
    name: "sharpen",
    process: (buf) =>
      processPipeline(buf, (img) => {
        img.convolution([
          [0, -1, 0],
          [-1, 5, -1],
          [0, -1, 0],
        ]);
      }),
  },
  {
    name: "upscale",
    process: (buf) =>
      processPipeline(buf, (img) => {
        img.scale(2);
      }),
  },
];

type OcrResult = {
  text: string;
  confidence: number;
};

async function runTesseract(
  buffer: Buffer,
  name: string
): Promise<OcrResult | null> {
  try {
    const { data } = await Tesseract.recognize(buffer, "eng");
    return {
      text: data.text ?? "",
      confidence: data.confidence ?? 0,
    };
  } catch (err) {
    console.warn(`[ocr] pipeline "${name}" failed:`, err);
    return null;
  }
}

export async function ocrReceipt(imageBase64: string): Promise<string> {
  const sourceBuffer = bufferFromBase64(imageBase64);

  let best: OcrResult | null = null;

  for (const pipeline of pipelines) {
    const processedBuffer = await pipeline.process(sourceBuffer);
    const result = await runTesseract(processedBuffer, pipeline.name);

    if (!result || result.confidence === 0) continue;

    if (result.confidence >= HIGH_CONFIDENCE) {
      return result.text;
    }

    if (!best || result.confidence > best.confidence) {
      best = result;
    }
  }

  return best?.text ?? "";
}
