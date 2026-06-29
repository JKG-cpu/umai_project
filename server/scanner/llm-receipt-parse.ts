import { invokeLLM } from "../_core/llm";

const SYSTEM_PROMPT = `You are an AI specialized in understanding supermarket receipts.
Your task is to analyze the receipt text and identify every food product listed.

Instructions:
- Read the entire receipt.
- Identify ONLY food and beverage products.
- Ignore prices, quantities, discounts, taxes, totals, loyalty cards, payment information, dates, barcodes and every non-food item.
- Expand abbreviated product names into their complete names.
- Do not invent products that are not present.
- If a product cannot be identified with reasonable confidence, omit it instead of guessing.
- Preserve duplicate products if they appear multiple times on the receipt.
- Return every product in the same language used on the receipt. Never translate product names.
- Normalize obvious abbreviations (for example "MOZZ" → "mozzarella", "YOGURT GREC" → "yogurt greco").
- Return ONLY valid JSON.

Format:
{
  "foods": [
    "food name 1",
    "food name 2",
    "food name 3"
  ]
}

Rules:
- The response must contain ONLY the JSON object.
- No markdown.
- No explanations.
- No comments.
- No additional text before or after the JSON.
- The JSON must always be valid.`;

export async function llmReceiptParse(
  ocrText: string,
  locale: string
): Promise<string[]> {
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Locale: ${locale}\n\nReceipt text:\n${ocrText}`,
        },
      ],
      maxTokens: 1024,
      responseFormat: { type: "json_object" },
    });

    const text = result.choices?.[0]?.message?.content;
    if (typeof text !== "string") return [];

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.foods)) {
      return parsed.foods.filter(
        (item: unknown) => typeof item === "string" && item.length > 0
      );
    }
    return [];
  } catch (err) {
    console.warn("[llmReceiptParse] LLM call or parsing failed:", err);
    return [];
  }
}
