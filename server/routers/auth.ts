import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user ?? null;
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie("app_session_id");
    return { success: true };
  }),
});
