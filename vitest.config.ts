import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/**/__tests__/**"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html"],
    },
    environment: "node",
    exclude: ["references/**", "node_modules/**", "dist/**"],
    include: ["src/**/*.test.ts"],
  },
});
