type MetricLabels = Record<string, string>;

const httpRequestsTotal = new Map<string, number>();
const httpErrorsTotal = new Map<string, number>();
const httpRequestDurationMsSum = new Map<string, number>();
const httpRequestDurationMsCount = new Map<string, number>();

const latencyBucketsMs = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const httpRequestDurationMsBucket = new Map<string, number>();

function normalizeLabelValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function createLabelKey(labels: MetricLabels): string {
  const sorted = Object.keys(labels).sort();
  return sorted.map((key) => `${key}=${labels[key]}`).join("|");
}

function formatLabels(labels: MetricLabels): string {
  const sorted = Object.keys(labels).sort();
  const inner = sorted.map((key) =>
    `${key}="${normalizeLabelValue(labels[key])}"`
  ).join(",");
  return `{${inner}}`;
}

function incrementMap(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function recordHttpRequestMetric(
  labels: MetricLabels,
  durationMs: number,
) {
  const baseKey = createLabelKey(labels);
  incrementMap(httpRequestsTotal, baseKey, 1);
  incrementMap(httpRequestDurationMsCount, baseKey, 1);
  incrementMap(httpRequestDurationMsSum, baseKey, durationMs);

  for (const bucket of latencyBucketsMs) {
    if (durationMs <= bucket) {
      const bucketKey = createLabelKey({ ...labels, le: String(bucket) });
      incrementMap(httpRequestDurationMsBucket, bucketKey, 1);
    }
  }
  const infBucketKey = createLabelKey({ ...labels, le: "+Inf" });
  incrementMap(httpRequestDurationMsBucket, infBucketKey, 1);
}

export function recordHttpErrorMetric(labels: MetricLabels) {
  const baseKey = createLabelKey(labels);
  incrementMap(httpErrorsTotal, baseKey, 1);
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];

  lines.push("# HELP denolith_http_requests_total Total HTTP requests.");
  lines.push("# TYPE denolith_http_requests_total counter");
  for (const [key, value] of httpRequestsTotal.entries()) {
    const labels = Object.fromEntries(
      key.split("|").map((entry) => {
        const [k, ...v] = entry.split("=");
        return [k, v.join("=")];
      }),
    );
    lines.push(`denolith_http_requests_total${formatLabels(labels)} ${value}`);
  }

  lines.push("# HELP denolith_http_errors_total Total HTTP error responses.");
  lines.push("# TYPE denolith_http_errors_total counter");
  for (const [key, value] of httpErrorsTotal.entries()) {
    const labels = Object.fromEntries(
      key.split("|").map((entry) => {
        const [k, ...v] = entry.split("=");
        return [k, v.join("=")];
      }),
    );
    lines.push(`denolith_http_errors_total${formatLabels(labels)} ${value}`);
  }

  lines.push(
    "# HELP denolith_http_request_duration_ms HTTP request latency in milliseconds.",
  );
  lines.push("# TYPE denolith_http_request_duration_ms histogram");

  for (const [key, value] of httpRequestDurationMsBucket.entries()) {
    const labels = Object.fromEntries(
      key.split("|").map((entry) => {
        const [k, ...v] = entry.split("=");
        return [k, v.join("=")];
      }),
    );
    lines.push(
      `denolith_http_request_duration_ms_bucket${
        formatLabels(labels)
      } ${value}`,
    );
  }

  for (const [key, value] of httpRequestDurationMsCount.entries()) {
    const labels = Object.fromEntries(
      key.split("|").map((entry) => {
        const [k, ...v] = entry.split("=");
        return [k, v.join("=")];
      }),
    );
    lines.push(
      `denolith_http_request_duration_ms_count${formatLabels(labels)} ${value}`,
    );
  }

  for (const [key, value] of httpRequestDurationMsSum.entries()) {
    const labels = Object.fromEntries(
      key.split("|").map((entry) => {
        const [k, ...v] = entry.split("=");
        return [k, v.join("=")];
      }),
    );
    lines.push(
      `denolith_http_request_duration_ms_sum${formatLabels(labels)} ${value}`,
    );
  }

  return `${lines.join("\n")}\n`;
}
