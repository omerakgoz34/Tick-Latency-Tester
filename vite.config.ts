import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig, type PluginOption } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

const root = dirname(fileURLToPath(import.meta.url));

async function optionalPlugin(rel: string, name: string): Promise<PluginOption | null> {
  const file = join(root, rel);
  if (!existsSync(file)) return null;
  const mod = (await import(pathToFileURL(file).href)) as Record<string, () => PluginOption>;
  return mod[name]();
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// `prod` emits a relative static bundle for GitHub Pages and similar hosts.
export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [];
  const appEnv = await optionalPlugin("./scripts/app-env-plugin.mjs", "appEnvPlugin");
  const pwa = await optionalPlugin("./scripts/grok-pwa-plugin.mjs", "grokPwaPlugin");
  if (appEnv) plugins.push(appEnv);
  if (pwa) plugins.push(pwa);
  plugins.push(tailwindcss(), preact({ reactAliasesEnabled: false, prefreshEnabled: true }));

  return {
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
    plugins,
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "es2022",
      cssMinify: "lightningcss",
      minify: "esbuild",
      sourcemap: false,
      cssCodeSplit: false,
      modulePreload: false,
      assetsInlineLimit: 2048,
      reportCompressedSize: true,
    },
  };
});
