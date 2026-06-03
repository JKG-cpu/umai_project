import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

const API_BASES = [
  "https://world.openfoodfacts.org/api/v3/product",
  "https://world.openbeautyfacts.org/api/v3/product",
  "https://world.openpetfoodfacts.org/api/v3/product",
];

async function lookupOne(barcode: string, baseUrl: string) {
  const url = `${baseUrl}/${barcode}.json`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Umai/1.0.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (data.status !== 1) return null;
  const product = data.product;
  if (!product) return null;
  return {
    productName: product.product_name || null,
    brands: product.brands || null,
    quantity: product.quantity || null,
    categories: product.categories || null,
  };
}

export const productRouter = router({
  lookup: publicProcedure
    .input(z.object({ barcode: z.string().min(1) }))
    .mutation(async ({ input }) => {
      for (const base of API_BASES) {
        const result = await lookupOne(input.barcode, base);
        if (result) return result;
      }
      return null;
    }),
});
