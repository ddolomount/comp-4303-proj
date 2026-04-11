export default [
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        requestAnimationFrame: "readonly",
        window: "readonly"
      }
    },
    rules: {
      camelcase: ["warn", { properties: "never" }],
      "id-match": [
        "warn",
        "^([a-z][A-Za-z0-9]*|[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9_]*|[a-z])$",
        {
          properties: false,
          onlyDeclarations: true
        }
      ],
      semi: ["warn", "always"],
      quotes: ["warn", "double", { avoidEscape: true }],
      "max-len": ["warn", { code: 80 }],
      "space-infix-ops": "warn",
      "comma-spacing": ["warn", { before: false, after: true }],
      "no-tabs": "warn",
      "no-multi-spaces": "warn"
    }
  }
];
