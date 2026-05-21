import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vite";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
  base: "./",
  server: {
    proxy: {
      "/api": "http://localhost:8482",
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || "0.0.0-dev"),
  },
  plugins: [
    react({
      useAtYourOwnRisk_mutateSwcOptions: () => {},
    }),
    svgr(),
    markdown(),
  ],
  build: {
    chunkSizeWarningLimit: 520,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("/@codemirror/") ||
            id.includes("/@uiw/react-codemirror") ||
            id.includes("/@uiw/codemirror-theme-vscode") ||
            id.includes("/codemirror-json-schema/")
          ) {
            return packageChunkName(id, "editor");
          }

          if (id.includes("/@rjsf/")) {
            return "rjsf";
          }

          if (id.includes("/@mui/") || id.includes("/@emotion/")) {
            return packageChunkName(id, "mui");
          }

          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "react";
          }

          if (id.includes("/ajv/")) {
            return "ajv";
          }
        },
      },
    },
  },
});

function packageChunkName(id: string, prefix: string) {
  const packagePath = id.slice(id.lastIndexOf("/node_modules/") + 14);
  const packageName = id
    .slice(id.lastIndexOf("/node_modules/") + 14)
    ?.split("/")
    .slice(0, packagePath.startsWith("@") ? 2 : 1)
    .join("-");

  return packageName
    ? `${prefix}-${packageName.replaceAll("@", "").replaceAll(".", "-")}`
    : prefix;
}

function markdown(): Plugin {
  return {
    name: "markdown-loader",
    transform(code, id) {
      if (id.slice(-3) === ".md") {
        return `export default ${JSON.stringify(code)}`;
      }
    },
  };
}
