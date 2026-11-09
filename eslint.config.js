// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*'],
  },
  {
    // The core is plain TypeScript: it must run in Jest without a phone.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                'react-native',
                'react-native-*',
                'expo',
                'expo-*',
                '@expo/*',
                '@react-native/*',
              ],
              message:
                'src/core is pure TypeScript: no React, React Native, Expo or native module.',
            },
            {
              group: ['@/app/*', '@/ui/*', '@/features/*', '@/adapters/*'],
              message: 'src/core must not depend on the layers above it.',
            },
          ],
        },
      ],
    },
  },
]);
