# ts-relayer

IBC Relayer in TypeScript

## Functionality

This will be both a isomorphic library (running in browsers and Node.js), as well as a simple binary
that can run to relay packets between chains. The library is meant to be very generic as to the business
logic, and you should be able to fork the relayer binary and add new functionality to it.

Please [look at the spec](./spec/index.md) for more information on the binary

## Development

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
