import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// `prod` emits a relative static bundle for GitHub Pages and similar hosts.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    appEnvPlugin(),
    grokPwaPlugin(),
    tailwindcss(),
    preact({ reactAliasesEnabled: false, prefreshEnabled: true }),
  ],
  build: {
    target: "es2022",
    cssMinify: "lightningcss",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 2048,
    reportCompressedSize: true,
  },
}));
