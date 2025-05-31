import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  typescript: true,
  pnpm: false,
  rules: {
    'no-console': 'off',
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'ts/consistent-type-imports': 'off',
  },
})
