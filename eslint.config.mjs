import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'temp_audio/**', 'temp_subtitles/**'],
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // 仓库现状：存在合理的动态数据/SDK 响应处理，先不强制消除 any。
      '@typescript-eslint/no-explicit-any': 'off',

      // 与 TS 版本的 unused-vars 规则对齐
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // 现有代码允许空 catch 用于清理/降噪
      'no-empty': 'off',

      // 当前代码中存在少量 require() 用法（例如 crypto.randomUUID），不强制迁移
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettierConfig,
]
