import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Three Fiber's render loop is imperative by design: useFrame mutates
    // THREE objects (mesh.rotation, material.uniforms) sixty times a second
    // because re-rendering React at that rate is exactly what it exists to
    // avoid. The React Compiler rules read that as impurity, so they are off
    // for the 3D scene only — every component outside scene/ still obeys them.
    files: ["src/features/odyssey/scene/**/*.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
    },
  },
  {
    // These effects reset local state when their subject changes (a new pin, a
    // new destination) before re-fetching. The idiomatic alternative is a React
    // `key`, but both panels are singletons driven by store state, not remounts.
    files: ["src/features/odyssey/ui/PlacePanel.tsx", "src/features/odyssey/ui/DestinationPanel.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
