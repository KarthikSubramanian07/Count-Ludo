import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // .github/skills and .github/hooks are vendored third-party tooling
    // (the Impeccable design skill), not project source; they're not ours
    // to lint.
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'node_modules',
      '.wrangler',
      '.github/skills',
      '.github/hooks',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  }
);
