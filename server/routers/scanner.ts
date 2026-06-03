import { z } from "zod";
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { publicProcedure, router } from "../_core/trpc";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const PYTHON_BIN = path.resolve(PROJECT_ROOT, "python-scanner", ".venv", "bin", "python");
const PYTHON_SCRIPT = path.resolve(PROJECT_ROOT, "python-scanner", "server_endpoint.py");

function findPython(): string {
  try {
    execFileSync(PYTHON_BIN, ["--version"], { stdio: "ignore" });
    return PYTHON_BIN;
  } catch {}
  for (const cmd of ["python3", "python"]) {
    try {
      execFileSync(cmd, ["--version"], { stdio: "ignore" });
      return cmd;
    } catch {}
  }
  throw new Error("Python not found");
}

async function runPythonScanner(mode: string, imageBase64: string) {
  const python = findPython();
  const { stdout, stderr } = await execFileAsync(python, [
    PYTHON_SCRIPT,
    "--mode", mode,
    "--image", imageBase64,
  ], {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (stderr) {
    console.error("[python-scanner] stderr:", stderr);
  }

  return JSON.parse(stdout);
}

export const scannerRouter = router({
  scanProduct: publicProcedure
    .input(z.object({ image: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const result = await runPythonScanner("product", input.image);
        return {
          success: result.success ?? false,
          error: result.error ?? null,
          barcode: result.barcode ?? null,
          format: result.format ?? null,
          productName: result.product_name ?? null,
          brands: result.brands ?? null,
          quantity: result.quantity ?? null,
          categories: result.categories ?? null,
          expirationDate: result.expiration_date ?? null,
        };
      } catch (err: any) {
        console.error("[python-scanner] error:", err);
        return {
          success: false,
          error: err.message ?? "Scanner failed",
          barcode: null,
          format: null,
          productName: null,
          brands: null,
          quantity: null,
          categories: null,
          expirationDate: null,
        };
      }
    }),

  scanExpiry: publicProcedure
    .input(z.object({ image: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const result = await runPythonScanner("expiry", input.image);
        return {
          success: result.success ?? false,
          error: result.error ?? null,
          barcode: result.barcode ?? null,
          format: result.format ?? null,
          expirationDate: result.expiration_date ?? null,
        };
      } catch (err: any) {
        console.error("[python-scanner] error:", err);
        return {
          success: false,
          error: err.message ?? "Expiry scan failed",
          barcode: null,
          format: null,
          expirationDate: null,
        };
      }
    }),
});
