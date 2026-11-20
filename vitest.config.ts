import { configDefaults, defineConfig } from "vitest/config";

// Scripts under scripts/ use node:test and have their own npm test commands.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "scripts/**"] },
});
