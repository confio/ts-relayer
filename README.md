# Relayer
Typescript implementation of an [IBC](https://ibcprotocol.org/) Relayer.

## Requirements
- [Node.js 14.16.1](https://nodejs.org/en/blog/release/v14.16.1/) or later

## Installation
### NPM
Install the [latest release](https://github.com/confio/ts-relayer/releases/latest).
```sh
npm i -g @confio/relayer
```

Alternatively, install from the `main` branch.
```sh
npm i -g @confio/relayer@main
```
> **NOTE:** We do a manual release after completing a predefined milestone or when it feels right. No release schedule is in place <em>yet</em>. To utilize the latest changes, use the `main` tag during the installation.


## Usage
After installation, `ibc-setup` and `ibc-relayer`  executables are available.

### ibc-setup  
Collection of commands to quickly setup a relayer and query IBC/chain data.
- run `ibc-setup --help` to print usage
- [ibc-setup spec](spec/ibc-setup.md)

### ibc-relayer
Reads the configuration and starts relaying packets.

- run `ibc-relayer --help` to print usage
- [ibc-relayer spec](spec/ibc-relayer.md)


## Quick start

### Configure and start the relayer

1. Init the configuration
   ```sh
   ibc-setup init --src relayer_test_1 --dest relayer_test_2
   ```
   - creates relayer's home directory at `~/.ibc-setup`
   - creates `app.yaml` inside relayer's home with `src`, `dest` and newly generated `mnemonic`
     - [What is app.yaml?]()
   - pulls default `registry.yaml` to relayer's home
     - [What is registry.yaml?]()
   - funds addresses on both sides so relayer can pay the fee while relaying packets

    > **NOTE:** Run `ibc-setup balances` to see the amount of tokens on each address.

2. Create `ics20` channel
    ```sh
    ibc-setup ics20
    ```
    - creates a new connection on source and desination chains
    - saves connection ids to `app.yaml` file
    - creates a new channel

3. Start the relayer in the verbose mode and 10s frequency polling
    ```sh
    ibc-relayer start -v --poll 10
    ```

### Send tokens between chains
1. Make sure `wasmd` binary is installed on your system
    - visit [https://github.com/CosmWasm/wasmd](https://github.com/CosmWasm/wasmd) and follow quick start instructions

2. Create a new account and fund it
    ```sh
    wasmd keys add sender
    JSON=$(jq -n --arg addr $(wasmd keys show -a sender) '{"denom":"umuon","address":$addr}')
    curl -X POST --header "Content-Type: application/json" --data "$JSON" http://49.12.73.189:8001/credit
    ```

3. Create another account to send tokens to
    ```sh
    wasmd keys add receiver
    ```
4. Send tokens
   ```sh
   wasmd tx ibc-transfer transfer transfer <channel-id> $(wasmd keys show -a receiver) 200umuon --from $(wasmd keys show -a sender) --node http://168.119.254.205:26657 --chain-id network-1 --fees 2000umuon
   ```
    - replace `<channel-id>` with the channel id obtained while configuring the relayer (2nd point)
    - if you cleared out the terminal, query the channel
      ```sh
      # replace `connection-id` with value of `srcConnection` property from `~/.ibc-setup/app.yaml` file
      ibc-setup channels --chain relayer_test_1 --connection <connection-id>
      ```
5. Observe the relayer output
## Configuration overview
in progress
