# Development

See [docs for starter pack](https://www.npmjs.com/package/typescript-starter).

### Set up local chains

To start two local blockchains, so we can test, run the following commands in two different consoles.

```sh
# in one console
./scripts/simapp/start.sh
# in another console
./scripts/wasmd/start.sh
```

When you are done, you can run the following in any console:

```sh
./scripts/simapp/stop.sh
./scripts/wasmd/stop.sh
```

### Setup binaries

Build the project.

```sh
yarn install
yarn build
```

Link the binaries so you can reference them w/o specifying the full path.

```sh
yarn link
```

Now, `ibc-setup` and `ibc-relayer` binaries should be available. If you run to a permission error by any chance, fix it.
```sh
chmod u+x ./build/binary/ibc-setup/index.js
chmod u+x ./build/binary/ibc-relayer/index.js
```

### CLI quick start

This is just mean for manual testing with the local CI chains defined in [demo/registry.yaml](./demo/registry.yaml).
First get some keys:

```sh
ibc-setup init --src local_wasm --dest local_simapp # initializes home directory at: ~/.ibc-setup
ibc-setup keys list
```

Then edit [manual/consts.ts](./src/lib/manual/consts.ts) and place your keys in those address variables.
* `exports.simappAddress = 'cosmos1y6m4llfs0ruxr0p67cs748vrv40ryh9r0gaqvd';`
* `exports.wasmdAddress = 'wasm1q6cggcxghka0yj88927zqs6d2pdq58wnkptx52';`

```sh
vi src/lib/manual/consts.ts
```

Send some coins to the relayer accounts to get started:
```sh
yarn build && yarn test:unit ./src/lib/manual/fund-relayer.spec.ts
```

Now you should see an updated balance, and can make an ics20 channel:

```sh
ibc-setup balances # show relayer account balances
ibc-setup ics20 # creates clients, connections and channels
```
For example:
```
Created channel:
  network-1: transfer/channel-21 (connection-0)
                      ^^^^^^^^^^
                         src
  network-2: custom/channel-10 (connection-0)
                    ^^^^^^^^^^
                       dest
````
Now we have a channel, let's send some packets. Go back to [manual/consts.ts](./src/lib/manual/consts.ts)
place the proper channel ids from in the channels object. Make sure to place the channel that was listed
next to (custom) on the top part. Then run a task to generate packets:

```sh
yarn build && yarn test:unit ./src/lib/manual/create-packets.spec.ts
```

With a connection, channel, and packets, let's start the relayer:

```sh
ibc-relayer start
```

### Testing

You must have the local blockchains running for the tests to pass.

Manually building, linting and testing:

```sh
yarn build
yarn test

# linting happens while testing, you can run it alone like this
yarn test:lint
```

Automatic build and test (you must watch build, as test setup watches for js changes).
Code will be build and tests run everytime you save a file:

```sh
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

```sh
./scripts/proto/get-proto.sh
./scripts/proto/define-proto.sh
```

This will overwrite the data in `src/codec` with newly generated definitions. We delete the folder first
to avoid outdated artifacts, meaning any manual changes will be lost.


### Useful npm scripts
Rebuild on every change.
```sh
yarn watch:build
```

Auto linter and prettier fix.
```sh
yarn fix
```