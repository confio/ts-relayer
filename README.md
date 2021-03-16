# ts-relayer

IBC Relayer in TypeScript

## Installation
```bash
npm i -g @confio/relayer

# with yarn
yarn global add @confio/relayer
```
## Functionality

This will be both a isomorphic library (running in browsers and Node.js), as well as a simple binary
that can run to relay packets between chains. The library is meant to be very generic as to the business
logic, and you should be able to fork the relayer binary and add new functionality to it.

Please [look at the spec](./spec/index.md) for more information on the binary

## Development

See [docs for starter pack](https://www.npmjs.com/package/typescript-starter).

### Set up local chains

To start two local blockchains, so we can test, run the following commands in two different consoles.

```bash
# in one console
./scripts/simapp/start.sh
# in another console
./scripts/wasmd/start.sh
```

When you are done, you can run the following in any console:

```bash
./scripts/simapp/stop.sh
./scripts/wasmd/stop.sh
```

### Running CLIs

Build the project.

```bash
yarn install
yarn build
```

Link the binaries so you can reference them w/o specifying the full path. Use `npm` since [yarn has issues with setting permissions](https://github.com/yarnpkg/yarn/issues/3587).

```bash
npm link
ibc-setup # should be available

./build/main/binary/ibc-setup/index.js # run w/o linking
```

### CLI quick start

This is just mean for manual testing with the local CI chains defined in [demo/registry.yaml](./demo/registry.yaml).
First get some keys:

```bash
ibc-setup init --src local_wasm --dest local_simapp # initializes home directory at: ~/.ibc-setup
ibc-setup keys list
```

Then edit [manual/consts.ts](./src/lib/manual/consts.ts) and place your keys in those address variables.
* `exports.simappAddress = 'cosmos1y6m4llfs0ruxr0p67cs748vrv40ryh9r0gaqvd';`
* `exports.wasmdAddress = 'wasm1q6cggcxghka0yj88927zqs6d2pdq58wnkptx52';`

```bash
vi src/lib/manual/consts.ts
```

Send some coins to the relayer accounts to get started:
```bash
yarn build && yarn test:unit ./src/lib/manual/fund-relayer.spec.ts
```

Now you should see an updated balance, and can make an ics20 channel:

```bash
ibc-setup balances # show relayer account balances
ibc-setup ics20 # creates clients, connections and channels
```
For example:
```
Created channels for connections connection-0 <=> connection-0: channel-21 (transfer) => channel-10 (custom)
                                                                ^^^^^^^^^^               ^^^^^^^^^^
                                                                   dest                     src
````
Now we have a channel, let's send some packets. Go back to [manual/consts.ts](./src/lib/manual/consts.ts)
place the proper channel ids from in the channels object. Make sure to place the channel that was listed
next to (custom) on the top part. Then run a task to generate packets:

```bash
yarn build && yarn test:unit ./src/lib/manual/create-packets.spec.ts
```

With a connection, channel, and packets, let's start the relayer:

```bash
ibc-relayer start
```

### Testing

You must have the local blockchains running for the tests to pass.

Manually building, linting and testing:

```bash
yarn build
yarn test

# linting happens while testing, you can run it alone like this
yarn test:lint
```

Automatic build and test (you must watch build, as test setup watches for js changes).
Code will be build and tests run everytime you save a file:

```bash
# in one console
yarn watch:build

# in another console
yarn watch:test
```

### Test Framework

I am using [Ava](https://github.com/avajs/ava) here simply because that was automatically set up with
the TypeScript helper. Rather than immediately rush to the well-known jasmine from CosmJS, I tried it out
and so far like the functionality. Nice test watcher, clean error messages, and clickable links right to
the failing source. Let's try this out a bit on this project.

You will want to read [how to write tests](https://github.com/avajs/ava/blob/master/docs/01-writing-tests.md)
and maybe a little [the list of valid assertions](https://github.com/avajs/ava/blob/master/docs/03-assertions.md#built-in-assertions)
before coding.

### Protobuf

To re-build the protobuf definitions, first look at [scripts/proto/env](./scripts/proto/env) and ensure you
have set the desired Cosmos SDK tag there (eg. `v0.41.0`). After that, run:

```bash
./scripts/proto/get-proto.sh
./scripts/proto/define-proto.sh
```

This will overwrite the data in `src/codec` with newly generated definitions. We delete the folder first
to avoid outdated artifacts, meaning any manual changes will be lost.

### Changelog and Publishing

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
