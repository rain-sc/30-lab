import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// 後台前端（設計見 ../docs/admin.md）
// - 本機 http://localhost:3200（strictPort：被占用就報錯，不自動換埠，避免跑到遊戲端的 3100）
// - /api 轉發到後端 8088：瀏覽器只跟 3200 說話，登入 cookie（tl_admin_token，SameSite=Lax）才會被帶上，也不需要 CORS
//   上線時由 Vercel 的 rewrites 做同樣的事，不要讓瀏覽器直接打後端的網址
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 3200,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:8088", changeOrigin: true },
    },
  },
  preview: {
    port: 3200,
    strictPort: true,
  },
});
