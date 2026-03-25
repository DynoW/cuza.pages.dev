import eslintPluginAstro from "eslint-plugin-astro";
export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.astro/**",
      "**/.wrangler/**",
      "**/coverage/**",
      "**/package.json",
      "**/package-lock.json",
      "**/yarn.lock",
      "**/pnpm-lock.yaml",
      "**/tsconfig.json",
      "**/eslint.config.js",
      "**/.eslintrc.js",
      "**/.prettierrc",
      "**/.prettierignore",
      "**/.git/**",
      "**/.github/**",
      "**/.vscode/**",
      "**/.idea/**",
      "**/.zsh/**"
    ],
  },
  // add more generic rule sets here, such as:
  // js.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      // override/add rules settings here, such as:
      // "astro/no-set-html-directive": "error"
    },
  },
];
