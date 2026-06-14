import { invokeLLM } from "../_core/llm";

export async function llmGuess(
  rawToken: string,
  storeId: string
): Promise<string> {
  const locale = storeId.split("-")[1] ?? "us";

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "user",
          content: `You are a receipt parser. Given an abbreviated item token from a supermarket receipt, return ONLY the plain English food item name in lowercase. No explanation, no punctuation.

Locale: ${locale}
Token: ${rawToken}`,
        },
      ],
      maxTokens: 64,
    });

    const text = result.choices?.[0]?.message?.content;
    if (typeof text === "string") {
      return text.trim().toLowerCase();
    }
    return rawToken.toLowerCase();
  } catch (err) {
    console.warn("[llmGuess] LLM call failed, falling back to raw token:", err);
    return rawToken.toLowerCase();
  }
}
