import { createPackageEslintConfig } from '@toolpath/dev-config/eslint-package'

export default [
  ...createPackageEslintConfig({ forbidStyling: true }),
  {
    // **No underscore escape for a parameter in the shipped scraper library.**
    //
    // `src/` publishes contracts other modules call against — `RecordMapper`
    // hands a mapper the `ColumnMap` that `registry` has just validated with
    // `checkColumnsExist`. Harvey's mapper took that argument as `_columns` and
    // read `family.columns` instead, so it validated one map and read another;
    // they are the same object today and the signature said they need not be.
    // An underscore is a fine way to say "I do not need this" in a callback and
    // the wrong way to say it about a contract, so here the parameter has to go
    // or be used.
    //
    // `src/` only. Tests legitimately take an argument to ignore it — stubbing
    // a fetcher, matching a callback shape — and hold no contract for anyone.
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]
