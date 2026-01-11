// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    pnpm: true,
    ignores: [
      '.github/**',
      'dist/**',
      'node_modules/**',
      'temp_audio/**',
      'temp_subtitles/**',
    ],
  },
  {
    rules: {
      // CLI project: allow console and process.exit
      'no-console': 'off',
      'node/no-process-exit': 'off',
      'node/prefer-global/process': 'off',

      // Keep existing code style; avoid large refactors
      'antfu/if-newline': 'off',
      'prefer-template': 'off',

      // Keep existing import/typing patterns
      'ts/consistent-type-definitions': 'off',

      // Avoid non-critical regexp and JSON ordering constraints
      'regexp/no-super-linear-backtracking': 'off',
      'regexp/strict': 'off',
      'jsonc/sort-keys': 'off',
      'jsonc/sort-array-values': 'off',

      // Tests: don't enforce title casing
      'test/prefer-lowercase-title': 'off',
    },
  },
)
