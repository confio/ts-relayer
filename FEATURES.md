# Feature Matrix

Here you can find an overview of the current functionality of the `ts-relayer`,
along with upcoming features. We are not focusing on
[implementation details](https://hermes.informal.systems/features/matrix.html)
but rather the cases that matter to users:

| Term | Description                                |
| :--: | ------------------------------------------ |
|  ✅  | Feature supported as of 0.1.2 (April 2021) |
|  🚧  | Feature planned for Q2 2021                |
|  ❌  | Feature not yet supported                  |
|  ❓  | Unsure if supported (needs tests)          |

### Setup

| Feature                                          | State |
| ------------------------------------------------ | :---: |
| One line install                                 |  ✅   |
| One line init for supported chains               |  ✅   |
| Can manually add custom chain definitions        |  ✅   |
| Create new client/connection                     |  ✅   |
| Create channel on existing client/connection     |  ✅   |
| One line ICS20 setup                             |  ✅   |
| Can configure arbitrary channels                 |  ✅   |
| Auto-loads tokens from faucets (testnets)        |  ✅   |
| Complete channel handshakes started by others    |  ❌   |
| Complete connection handshakes started by others |  ❌   |
| Create connections with non-zero packet delay    |  ❌   |

### Relaying

| Feature                                          |  State  |
| ------------------------------------------------ | :-----: |
| Relay unordered channels                         |   ✅    |
| Relay ordered channels                           | 🚧 / ❌ |
| Relay acknowledgements                           |   ✅    |
| Relay timeouts                                   |   ✅    |
| Relay timeout on closed channel                  |   ❌    |
| Auto-update client (keep alive)                  |   ✅    |
| Auto-detect needed gas for non-ics20 packets     |   ❌    |
| Dynamically relay channels (all on 1 connection) |   ✅    |
| Only relay on one channel                        |   🚧    |
| Only relay on one port                           |   🚧    |
| Only relay by sender (whitelist)                 |   🚧    |
| Dynamic config without restart                   |   ❌    |
| Resume relay on restart                          |   ✅    |
| Handles multiple relayers on one connection      |   ❓    |
| Submit misbehavior evidence                      |   ❌    |
| Relay packets with delay                         |   ❌    |

### DevOps support

| Feature                                         | State |
| ----------------------------------------------- | :---: |
| Helpful, clear log messages                     |  ✅   |
| Easy configuration of log-levels                |  ✅   |
| Write to log file in JSON                       |  ✅   |
| Pipe logs to ELK stack analytics                |  🚧   |
| Expose basic metrics (eg. CPU, packets relayed) |  🚧   |
| Expose detailed metrics                         |  🚧   |
| Prometheus integration                          |  🚧   |
| Sample Grafana dashboards                       |  🚧   |
| Sample systemd/etc configs                      |  🚧   |
| Sample primary/secondary fallover scripts       |  ❌   |

### Key Management

| Feature                                      | State |
| -------------------------------------------- | :---: |
| Unencrypted mnemonic on disk (daemon mode)   |  ✅   |
| Enter mnemonic at prompt (interactive mode)  |  ✅   |
| Use TMKMS to sign (KMS not yet support IBC ) |  ❌   |

### Library Support

| Feature                          | State |
| -------------------------------- | :---: |
| Easy to embed in webapp          |  ✅   |
| Easy to embed in custom node app |  ✅   |
| Example how to embed in webapp   |  🚧   |

### Documentation

| Feature                                  | State |
| ---------------------------------------- | :---: |
| Quick Start guide to demo                |  ✅   |
| Developer onboarding documentation       |  ✅   |
| Intuitive CLI and help text              |  ✅   |
| Detailed docs how to setup custom chains |  🚧   |
| Tutorials on how to customize            |  ❌   |
