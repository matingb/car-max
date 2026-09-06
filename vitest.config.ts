import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    jsxInject: 'import React from "react"',
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setupTests.ts"],
    globals: true,
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "**/*.integration.test.ts"],
    restoreMocks: true,
  },
});


