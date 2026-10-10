import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));
export default defineConfig({
  root: path("./"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/hooks\/usePlan$/, replacement: path("./mocks.tsx") },
      { find: /^@\/lib\/ai\/analyze.functions$/, replacement: path("./mocks.tsx") },
      { find: /^@tanstack\/react-start$/, replacement: path("./mocks.tsx") },
      { find: /^@tanstack\/react-router$/, replacement: path("./mocks.tsx") },
      { find: "@", replacement: path("../../src") },
    ],
  },
  server: { fs: { allow: [path("../../")] } },
});
