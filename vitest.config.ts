import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

function vendored(entry: string): string {
  return fileURLToPath(new URL(`./node_modules/next/dist/compiled/${entry}`, import.meta.url));
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    // Component tests use hooks (useFormState/useFormStatus) that only exist in
    // the React build Next.js vendors for the App Router, so react and react-dom
    // both have to resolve to that build.
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: /^react$/, replacement: vendored("react/index.js") },
      { find: /^react\/jsx-runtime$/, replacement: vendored("react/jsx-runtime.js") },
      { find: /^react\/jsx-dev-runtime$/, replacement: vendored("react/jsx-dev-runtime.js") },
      { find: /^react-dom$/, replacement: vendored("react-dom/index.js") },
      { find: /^react-dom\/client$/, replacement: vendored("react-dom/index.js") },
    ],
  },
});
