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

function inlineCss(): PluginOption {
  return {
    name: "inline-css",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const htmlName = Object.keys(bundle).find((name) => name.endsWith(".html"));
      if (!htmlName) return;
      const html = bundle[htmlName];
      if (html.type !== "asset" || typeof html.source !== "string") return;
      let source = html.source;
      for (const [name, item] of Object.entries(bundle)) {
        if (item.type !== "asset" || !name.endsWith(".css")) continue;
        const css = typeof item.source === "string" ? item.source : new TextDecoder().decode(item.source);
        const file = name.split("/").pop() ?? name;
        const fixed = css.replace(/url\((['"]?)(?:\.\/)?([^'")]+)\1\)/g, (_m, q, path) => {
          const target = path.startsWith("assets/") || path.startsWith("/") || path.startsWith("data:") ? path : `./assets/${path}`;
          return `url(${q}${target}${q})`;
        });
        const link = new RegExp(`<link[^>]*href="[^"]*${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`);
        if (!link.test(source)) continue;
        source = source.replace(link, () => `<style>${fixed}</style>`);
        delete bundle[name];
      }
      html.source = source;
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// `prod` emits a relative static bundle for GitHub Pages and similar hosts.
export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [];
  const appEnv = await optionalPlugin("./scripts/app-env-plugin.mjs", "appEnvPlugin");
  const pwa = await optionalPlugin("./scripts/grok-pwa-plugin.mjs", "grokPwaPlugin");
  if (appEnv) plugins.push(appEnv);
  if (pwa) plugins.push(pwa);
  plugins.push(tailwindcss(), preact({ reactAliasesEnabled: false, prefreshEnabled: true }), inlineCss());

  return {
    base: command === "build" ? "./" : "/",
    server: {
      host: "0.0.0.0",
      port: 8080,
      strictPort: true,
      allowedHosts: true,
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
