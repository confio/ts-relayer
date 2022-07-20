# Local Gaiad development network

Configuration is in the `env` file, that is the most likely place you want to adjust

## Initializing new data

```bash
scripts/gaia/generate_template.sh
```

Note that the addresses receiving tokens in genesis are set here, you can customize by editting this file

## Starting the blockchain

Run the following:

```bash
scripts/gaia/start.sh
```

You get filtered output on the console. If it crashes and you want the full logs, look at `debug.log`.

## Stopping the blockchain

While running the blockchain in one terminal, open a second one and run this:

```bash
scripts/gaia/stop.sh
```
