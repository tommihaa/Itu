import { defineConfig } from "vite";

// Minimaalinen Vite-konfiguraatio Superjatsin mallin mukaan.
// Domain-testit ovat puhdasta TS:ää, node-ympäristö riittää.
export default defineConfig({
  server: {
    port: 5177,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
