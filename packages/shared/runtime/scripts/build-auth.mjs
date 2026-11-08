import { build } from "../standalone/node_modules/esbuild/lib/main.js";
await build({
  entryPoints: ["standalone/src/auth.js"],
  outfile: "public/auth.js",
  bundle: true,
  format: "iife",
  minify: true,
  define: { __AUTH_CONFIG__: JSON.stringify({ hosted: true }) },
});
