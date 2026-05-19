# Observability Baseline

This folder provides a production-ready baseline for API metrics, logs, dashboards, and alerts.

## Components

The stack includes:
- **Prometheus**: Metrics collection and alerting evaluation (Port `9090`).
- **Grafana**: Visualization of metrics and logs (Port `3000`).
- **Alertmanager**: Handles alerts routing and notifications (Port `9093`).
- **Loki**: Centralized log storage (Port `3100`).
- **Promtail**: Log shipper that collects logs from Docker containers.
- **cAdvisor**: Analyzes resource usage of running containers (Port `8080`).
- **Exporters**: 
  - `postgres-exporter` (Port `9187`)
  - `redis-exporter` (Port `9121`)
  - `node-exporter` (Port `9100`)

## How to Run

All observability services are integrated into the local Docker Compose file. To start them along with your databases, run:

```bash
docker compose -f compose.local.yml up -d
```

## Metrics Endpoint

The application exposes metrics at:
- Endpoint: `GET /metrics` (on port `9999` by default)
- Format: Prometheus text exposition

Core metrics collected:
- `denolith_http_requests_total{method,route,status}`
- `denolith_http_errors_total{method,route,status,error_class}`
- `denolith_http_request_duration_ms_bucket{method,route,status,le}`

## Grafana Setup

- **URL**: `http://localhost:3000`
- **Credentials**: `admin` / `admin`
- **Auto-Provisioning**: Data sources and dashboards are automatically loaded on startup:
  - **Data sources**: Prometheus, Loki, and Alertmanager are pre-configured.
  - **Dashboards pre-loaded**:
    - `Denolith API Baseline` (Your app metrics)
    - `Node Exporter Full` (Host/OS metrics)
    - `Postgres Exporter` (Database metrics)
    - `Redis Exporter` (Cache metrics)
    - `CADVISOR exporter` (Per-container metrics)
    - `Prometheus 2.0 Overview` (Self-monitoring)

## Centralized Logs (Loki)

Logs from all running Docker containers are automatically scraped by Promtail.
To view logs:
1. Go to the **Explore** tab in Grafana.
2. Select **Loki** from the data source dropdown.
3. Use a query like `{container="denolith-postgres-1"}` to view logs for a specific container.

## Alert Rules

- File: `docs/observability/prometheus-alert-rules.yml`
- Included baseline alerts:
  - High 5xx ratio warning (>2% for 10m)
  - High 5xx ratio critical (>5% for 5m)
  - High p95 latency (>1000ms for 10m)
  - No traffic for 15m

Alerts are sent to Alertmanager. You can configure routing to Slack, Telegram, or Email in `docs/observability/alertmanager.yml`.
