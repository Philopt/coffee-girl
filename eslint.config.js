export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        Phaser: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn'
    }
  }
];
