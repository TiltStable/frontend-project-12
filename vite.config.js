import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Vite bakes VITE_* variables at build time, so a production build made
  // without the DSN ships unmonitored; its only runtime signal is a
  // console.warn in the visitor's browser, and the build log is where the
  // deployer actually looks.
  const env = loadEnv(mode, rootDir, "VITE_");
  if (mode === "production" && !env.VITE_SENTRY_DSN?.trim()) {
    console.warn("VITE_SENTRY_DSN is not set: this production build ships without error reporting");
  }

  return {
    plugins: [react()],
    resolve: {
      // The app never filters french: leo-profanity requires this optional
      // dictionary package (~78 kB in the bundle) for a language the library
      // registers and the app never selects. The stub keeps the library's
      // silent try/catch degradation working.
      alias: {
        "french-badwords-list": path.resolve(rootDir, "src/shims/french-badwords-list.js"),
      },
    },
    server: {
      port: 5002,
      proxy: {
        "/api": {
          target: "http://localhost:5001",
        },
        "/socket.io": {
          target: "ws://localhost:5001",
          ws: true,
          rewriteWsOrigin: true,
        },
      },
    },
    test: {
      setupFiles: "./__tests__/setup-i18n.js",
    },
  };
});
