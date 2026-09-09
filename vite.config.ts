import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Kamera/mikrofon (halaman AI Interview kandidat) hanya diizinkan browser pada secure context
  // (HTTPS atau localhost). Di LAN dev (http://10.24.240.120:5174) getUserMedia tidak pernah
  // muncul prompt-nya. VITE_HTTPS=true menyalakan sertifikat self-signed untuk dev server.
  const useHttps = env.VITE_HTTPS === "true";

  return {
    plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
    server: {
      host: true, // listen on all interfaces so the dev server is reachable from other machines
      port: 5174,
      proxy: {
        // Laravel API lewat path same-origin agar halaman HTTPS tidak memanggil API HTTP (mixed
        // content). Pakai VITE_API_URL_LOCAL=/api bersama VITE_HTTPS=true.
        "/api": {
          target: env.LARAVEL_API_PROXY_TARGET || "http://localhost:8081",
          changeOrigin: true,
        },
        // Halaman AI Interview kandidat (/interview/:token) memanggil AI Interview API (FastAPI)
        // untuk text-to-speech dan WebSocket speech-to-text. Di produksi reverse proxy (Caddy)
        // harus meneruskan /ai-api/* dengan cara yang sama.
        "/ai-api": {
          target: env.AI_API_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
          ws: true,
          rewrite: (p) => p.replace(/^\/ai-api/, ""),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: ["@ckeditor/ckeditor5-build-classic", "@ckeditor/ckeditor5-react"],
    },
    build: {
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-radix": ["radix-ui"],
            "vendor-ui": ["cmdk", "sonner", "vaul", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge"],
          },
        },
      },
    },
  };
});
