import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Scripts under scripts/ use node:test and have their own npm test commands.
export default defineConfig({
  // Source tests can run before the release package has been built.
  resolve: {
    alias: [
      {
        find: /^lingop\/ui\/next\/stroke-provider$/,
        replacement: fileURLToPath(new URL("./src/ui/next/stroke-provider.ts", import.meta.url)),
      },
    ],
  },
  test: { exclude: [...configDefaults.exclude, "scripts/**"] },
});
