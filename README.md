# ts-relayer

IBC Relayer in TypeScript

See [docs for starter pack](https://www.npmjs.com/package/typescript-starter).

Please use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) for all commit messages. Some basic examples:

```
feat(api): add client upgrade to API
docs: update README
fix(client): properly reconnect
refactor!: Rewrite public API
```

Examples:

```
# normal flow
yarn build
yarn test
yarn fix

# advanced checks
yarn cov
yarn doc

# constant builder
yarn watch:build
```

Publishing workflow:

```
yarn global add commitizen

# bump version and update changelog
yarn version

# OR do full release prep
yarn prepare-release
```
