import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routers/auth";
import { productRouter } from "./routers/product";
import { scannerRouter } from "./routers/scanner";
import { router } from "./_core/trpc";

export const appRouter = router({
  auth: authRouter,
  system: systemRouter,
  product: productRouter,
  scanner: scannerRouter,
});

export type AppRouter = typeof appRouter;
