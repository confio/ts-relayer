# Logging

A critical part of any automated service is good logging. We should provide data at multiple log levels.
INFO for those who like updates, ERROR to always print out clear error messages when a call fails, and
VERBOSE or DEBUG for more detailed info, on every RPC call made.

Log files may be consumed both in the console (for those testing out a relayer for the first time)
as well as written to files, which are then intended to be indexed by another service, eg. the
[ELK stack](https://www.elastic.co/elastic-stack).

We look for a logging library that allows us to add all details we need in the library and easily turn
on of off log levels and control the output format with a few command-line flags. The leading candidate
for such a library is [Winston JS](https://github.com/winstonjs/winston).

## Flags

Both processes support some logging flags. By default, they both log at INFO level, and only write
to the console.

- `--log-level=debug|verbose|info|warn|error` - sets the minimum level to log at, everything below this level is ignored
- `--verbose` or `-v` is an alias to `--log-level=verbose`
- `--quiet` or `-q` is an alias to `--log-level=error`
- `--log-file=<path>` - specified a file to write to, logs will be written in JSON format to the file
  (but a human-readable format to the console)
- `--stack-trace` - prints stack trace along with error messages

Note: if multiple flags that set log-level are set (eg. `-v -q --log-level=info`), then the most permissive level is taken. (In this case `verbose`).

We may add additional flags later if we need more control of formats of transports.
