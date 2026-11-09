import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const mediapipeVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "node_modules/@mediapipe/tasks-vision/package.json"), "utf8"),
).version;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __MEDIAPIPE_VERSION__: JSON.stringify(mediapipeVersion),
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    target: ["es2020", "safari15"],
    cssTarget: "safari15",
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,jpg,ico,woff,woff2,webmanifest}"],
        globIgnores: ["mediapipe/**", "pwa/startup/**", "data/**", "templates/**", "placeholder.svg"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
  worker: {
    format: "es",
  },
}));
