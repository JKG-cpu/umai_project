import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { ocrReceipt } from "../scanner/ocr";
import { detectStore } from "../scanner/store-detection";
import { filterItemTokens } from "../scanner/token-filter";
import { resolveToken, recordVote } from "../scanner/vote-service";
import { getStores, upsertStore } from "../scanner/db";

export const scannerRouter = router({
  scanReceipt: protectedProcedure
    .input(z.object({ image: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const ocrText = await ocrReceipt(input.image);
        const ocrLines = ocrText.split("\n").filter(Boolean);

        const storeResult = detectStore(ocrLines);
        const tokens = filterItemTokens(ocrText);

        const items = await Promise.all(
          tokens.map(async (token) => {
            const resolved = await resolveToken(token, storeResult.storeId ?? "unknown");
            return {
              rawToken: token,
              label: resolved.label,
              locked: resolved.locked,
              confidence: resolved.confidence,
            };
          })
        );

        return {
          success: true,
          store: storeResult,
          items,
          ocrText: ocrText.slice(0, 2000),
        };
      } catch (err: any) {
        console.error("[scanner] scanReceipt error:", err);
        return {
          success: false,
          error: err.message ?? "Receipt scan failed",
          store: null,
          items: [],
          ocrText: null,
        };
      }
    }),

  submitVote: protectedProcedure
    .input(
      z.object({
        storeId: z.string().min(1),
        rawToken: z.string().min(1),
        label: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await recordVote(ctx.user.openId, input.storeId, input.rawToken, input.label);
        return { success: true };
      } catch (err: any) {
        console.error("[scanner] submitVote error:", err);
        return { success: false, error: err.message ?? "Vote recording failed" };
      }
    }),

  getTokenStatus: publicProcedure
    .input(
      z.object({
        storeId: z.string().min(1),
        rawToken: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const resolved = await resolveToken(input.rawToken, input.storeId);
      return resolved;
    }),

  confirmStore: protectedProcedure
    .input(
      z.object({
        storeId: z.string().min(1),
        storeName: z.string().min(1),
        locale: z.string().min(1).max(8),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await upsertStore(input.storeId, input.storeName, input.locale);
        return { success: true };
      } catch (err: any) {
        console.error("[scanner] confirmStore error:", err);
        return { success: false, error: err.message ?? "Store confirmation failed" };
      }
    }),

  getKnownStores: publicProcedure.query(async () => {
    const stores = await getStores();
    return stores;
  }),
});
