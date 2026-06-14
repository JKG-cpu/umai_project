import { ImageAnnotatorClient } from "@google-cloud/vision";

let _client: ImageAnnotatorClient | null = null;

function getClient() {
  if (!_client) {
    _client = new ImageAnnotatorClient();
  }
  return _client;
}

function stripDataUriPrefix(b64: string): string {
  const idx = b64.indexOf(",");
  return idx !== -1 ? b64.slice(idx + 1) : b64;
}

export async function ocrReceipt(imageBase64: string): Promise<string> {
  const client = getClient();
  const raw = stripDataUriPrefix(imageBase64);

  const [result] = await client.textDetection({
    image: { content: raw },
  });

  const annotations = result.textAnnotations ?? [];
  const description = annotations[0]?.description ?? "";
  const lines = description
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.join("\n");
}
