import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    // Salinan worktree di .claude/ membuat modul ganda (instanceof gagal) bila ikut dipindai.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
