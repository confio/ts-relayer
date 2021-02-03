# Metrics

When a service is running 24/7 and has been stable for weeks, no one every looks at the log
files unless it crashes. However, for continuous monitoring and alerting, exposing a set of
metrics from the binary can be very useful. These metrics can then be fed into a
[dashboard like Grafana](https://grafana.com/grafana/dashboards) and then be connected to
an alerting software like [Pager Duty](https://pagerduty.com) via a
[plugin](https://grafana.com/grafana/plugins/xginn8-pagerduty-datasource), to easily provide
notifications on critical situations, like running low on funds or unusually high errors
relaying packets of submitting client updates.

Tendermint uses Prometheus to produce relevant metrics. Since Prometheus is Go-centric, we
must find an equivalent library for TypeScript. This task is to _produce_ the data.
Actually hooking it up to a dashboard is left as a DevOps task for each team deploying the relayer.

TODO: select library to use:

[Prometheus](https://prometheus.io/) metric collection (or similar):

- [`prom-client`](https://github.com/siimon/prom-client) - The official prometheus client for Node.js. All js, but there
  is an `index.d.ts`
- [`promts`](https://github.com/base698/promts) - A native TypeScript implementation of a Prometheus client.
  Seems quite a young project to depend on.
- [`appmetrics`](https://github.com/RuntimeTools/appmetrics) - Provides a lot of Node.js and DB related metrics.
  It seems to allow [custom events](https://github.com/RuntimeTools/appmetrics#appmetricsemittype-data), but only seems
  to plug into their Dashboard
- [`prometheus-api-metrics`](https://github.com/PayU/prometheus-api-metrics) seems like a more mature (v3.1.0) but
  less actively developed version of `promts`. It seems designed for express and koa apps, but may be able to
  be used more generally.

[OpenTracing](https://opentracing.io/) libraries (for debugging distributed systems, likely overkill here):

- [SignalFX](https://www.splunk.com/en_us/blog/devops/monitoring-node-js-applications-with-signalfx.html)
- [OpenTracing Client](https://github.com/opentracing/opentracing-javascript)
