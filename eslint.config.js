// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

/** Imports run one way: app → features → sports → shared. */
const NO_DEEP_IMPORT = {
  group: ['@/features/*/*', '@/sports/*/*'],
  message: 'Enter a feature or a sport through its index.ts: @/features/<name>, @/sports/<name>.',
};
const NO_APP = {
  group: ['@/app', '@/app/*'],
  message: 'Nothing imports a route: app/ is at the top.',
};
const PURE = {
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
    'Pure TypeScript here (logic/, sports/, shared/lib/): no React, React Native, Expo or native module, so it runs without a phone.',
};
const SPORT_DEPENDS_ON_NOTHING = {
  group: ['@/features', '@/features/*', '@/app', '@/app/*', '@/shared/ui/*', '@/shared/native/*'],
  message: 'A sport is its rules only: it depends on no feature, no screen, no native code.',
};
const SHARED_KNOWS_NO_BUSINESS = {
  group: ['@/features', '@/features/*', '@/sports', '@/sports/*', '@/app', '@/app/*'],
  message: 'shared/ knows no feature and no sport.',
};

const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*'],
  },
  {
    files: ['src/**'],
    rules: {
      ...restrict(NO_DEEP_IMPORT),
      'import/no-cycle': 'error',
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  // Later blocks replace the patterns of earlier ones for their files: each lists all it needs.
  { files: ['src/features/**'], rules: restrict(NO_DEEP_IMPORT, NO_APP) },
  { files: ['src/features/*/logic/**'], rules: restrict(NO_DEEP_IMPORT, NO_APP, PURE) },
  { files: ['src/sports/**'], rules: restrict(NO_DEEP_IMPORT, PURE, SPORT_DEPENDS_ON_NOTHING) },
  { files: ['src/shared/**'], rules: restrict(SHARED_KNOWS_NO_BUSINESS) },
  { files: ['src/shared/lib/**'], rules: restrict(SHARED_KNOWS_NO_BUSINESS, PURE) },
]);
