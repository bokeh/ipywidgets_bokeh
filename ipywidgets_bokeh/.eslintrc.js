module.exports = {
  extends: [],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    tsconfigRootDir: ".",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "deprecation"],
  rules: {
    "@typescript-eslint/ban-types": [
      "error",
      {
        types: {
          Function: false,
          object: false,
          "{}": false,
        },
      },
    ],
    "@typescript-eslint/consistent-type-assertions": "error",
    "@typescript-eslint/member-delimiter-style": [
      "error",
      {
        multiline: {
          delimiter: "none",
          requireLast: true,
        },
        singleline: {
          delimiter: "comma",
          requireLast: false,
        },
      },
    ],
    "@typescript-eslint/semi": ["error", "never"],
    "@typescript-eslint/type-annotation-spacing": ["error"],
    "@typescript-eslint/no-unnecessary-condition": [
      "warn",
      {
        allowConstantLoopConditions: true,
      },
    ],
    "@typescript-eslint/strict-boolean-expressions": [
      "error",
      {
        allowAny: true,
      },
    ],
    "@typescript-eslint/no-unnecessary-type-assertion": ["error"],
    "@typescript-eslint/no-unnecessary-type-constraint": ["error"],
    "no-self-assign": [
      "error",
      {
        props: false,
      },
    ],
    "brace-style": [
      "error",
      "1tbs",
      {
        allowSingleLine: true,
      },
    ],
    "comma-dangle": ["off"],
    "@typescript-eslint/comma-dangle": [
      "error",
      {
        arrays: "always-multiline",
        objects: "always-multiline",
        imports: "always-multiline",
        exports: "always-multiline",
        functions: "always-multiline",
        enums: "always-multiline",
        generics: "always-multiline",
        tuples: "always-multiline",
      },
    ],
    "comma-spacing": [
      "error",
      {
        before: false,
        after: true,
      },
    ],
    "dot-notation": "error",
    "eol-last": ["error", "always"],
    indent: "off",
    "@typescript-eslint/indent": [
      "error",
      2,
      {
        SwitchCase: 1,
        outerIIFEBody: 1,
        ArrayExpression: "first",
        ObjectExpression: "first",
        ImportDeclaration: "first",
        VariableDeclarator: "first",
        CallExpression: {
          arguments: 1,
        },
        FunctionDeclaration: {
          body: 1,
          parameters: "off",
        },
        FunctionExpression: {
          body: 1,
          parameters: "off",
        },
        ignoredNodes: ["ConditionalExpression"],
      },
    ],
    "no-debugger": "error",
    "no-floating-decimal": ["error"],
    "no-multiple-empty-lines": [
      "error",
      {
        max: 1,
        maxBOF: 0,
        maxEOF: 0,
      },
    ],
    "no-new-wrappers": "error",
    "no-template-curly-in-string": "error",
    "no-throw-literal": "error",
    "no-trailing-spaces": ["error"],
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-const": [
      "error",
      {
        destructuring: "all",
      },
    ],
    "prefer-exponentiation-operator": "error",
    "quote-props": ["error", "as-needed"],
    "object-curly-spacing": ["error", "never"],
    "space-before-blocks": ["error", "always"],
    "space-before-function-paren": [
      "error",
      {
        anonymous: "never",
        named: "never",
        asyncArrow: "always",
      },
    ],
    "space-in-parens": ["error", "never"],
    "keyword-spacing": [
      "error",
      {
        before: true,
        after: true,
      },
    ],
    "func-call-spacing": ["error", "never"],
    "no-whitespace-before-property": ["error"],
    "block-spacing": ["error", "always"],
    "key-spacing": [
      "error",
      {
        beforeColon: false,
        afterColon: true,
        mode: "minimum",
      },
    ],
    "space-unary-ops": [
      "error",
      {
        words: true,
        nonwords: false,
        overrides: {},
      },
    ],
    "guard-for-in": ["error"],
    quotes: [
      "error",
      "double",
      {
        avoidEscape: true,
        allowTemplateLiterals: false,
      },
    ],
    "prefer-template": ["error"],
    "generator-star-spacing": [
      "error",
      {
        before: false,
        after: true,
        anonymous: {
          before: false,
          after: true,
        },
        method: {
          before: true,
          after: false,
        },
      },
    ],
    "yield-star-spacing": [
      "error",
      {
        before: false,
        after: true,
      },
    ],
    "deprecation/deprecation": ["error"],
  },
}
