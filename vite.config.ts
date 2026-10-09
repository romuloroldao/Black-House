import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

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
