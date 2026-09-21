import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

// One self-contained ESM file. Home Assistant loads it as a Lovelace resource,
// so nothing may be left as an external import - Lit is bundled in.
export default defineConfig({
  build: {
    target: "es2021",
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => `${pkg.name}.js`,
    },
    rollupOptions: {
      external: [],
      output: {
        // Home Assistant loads ONE Lovelace resource and HACS ships one file.
        // Without this the lazily imported editor becomes a second chunk that
        // never gets deployed, and the visual editor silently fails to open.
        inlineDynamicImports: true,
      },
    },
    minify: "esbuild",
    sourcemap: false,
    emptyOutDir: true,
  },
  define: {
    __CARD_VERSION__: JSON.stringify(pkg.version),
    __CARD_NAME__: JSON.stringify(pkg.name),
  },
});
