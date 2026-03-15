import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules',
      '**/dist',
      '.next',
      '.vscode',
      '.git',
      'coverage',
      'build',
    ],
  },
  {
    files: ['apps/**/*.{js,jsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        document: 'readonly',
        window: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...prettierConfig.rules,

      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-deprecated': 'warn',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Node.js API — globals do Node 18+ (fetch, Buffer, etc.)
    files: ['apps/api/**/*.js'],
    languageOptions: {
      globals: {
        // Node.js built-ins
        Buffer: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Node 18+ fetch global
        fetch: 'readonly',
        // Timers
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        // URL API
        URL: 'readonly',
        URLSearchParams: 'readonly',
        // Console
        console: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn'],
    },
  },
  {
    files: ['apps/api/src/**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        // Jest globals
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        it: 'readonly',
        // Node.js globals needed in tests
        Buffer: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
      },
    },
  },
];
