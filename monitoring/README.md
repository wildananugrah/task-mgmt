# Logging and Monitoring Setup

This directory contains the complete monitoring stack for the be-api-generic application, including:
- **Loki** for log aggregation
- **Grafana** for visualization and dashboards
- **Prometheus** for metrics collection
- **Promtail** for log shipping

## Features

### Application Logging
The be-api-generic application logs the following information for each request:
1. **Timestamp** - ISO 8601 format timestamp
2. **User ID** - Extracted from JWT token if authenticated
3. **Request ID** - Unique UUID for request tracing
4. **HTTP Method** - GET, POST, PUT, DELETE, etc.
5. **URI** - Request path and query parameters
6. **HTTP Status Code** - Response status
7. **Request Body** - Sanitized request payload
8. **Response Body** - Sanitized response payload
9. **Elapsed Time** - Request processing time in milliseconds

### Metrics Collection
The application exposes Prometheus metrics at `/metrics` endpoint:
- Request counts by method and path
- Request duration percentiles (p50, p95, p99)
- Response status code distribution
- Error rates by endpoint
- Memory usage statistics
- Application uptime

## Quick Start

### 1. Start the Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

This will start:
- **Loki** at http://localhost:3100
- **Grafana** at http://localhost:3030 (admin/admin)
- **Prometheus** at http://localhost:9090
- **Promtail** (log collector, no UI)
- **Node Exporter** at http://localhost:9100

### 2. Configure the Application

Add these environment variables to your `.env` file:

```env
# Logging and Monitoring
LOKI_URL=http://localhost:3100
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
ENABLE_RESPONSE_LOGGING=true
LOG_SENSITIVE_DATA=false
```

### 3. Install Dependencies

```bash
cd ../be-api-generic
bun install
```

### 4. Create Log Directory

```bash
mkdir -p logs
```

### 5. Start the Application

```bash
bun run dev
# or with PM2
pm2 start pm2.config.cjs
```

## Accessing the Services

### Grafana Dashboard
1. Open http://localhost:3030
2. Login with `admin/admin` (change password on first login)
3. Navigate to Dashboards → API Monitoring Dashboard

The dashboard includes:
- Request rate by status code
- Average response time gauge
- Request distribution by HTTP method
- Top API endpoints
- Recent logs viewer
- Error rate statistics
- Active users count
- Requests per second
- Success rate percentage

### Prometheus Metrics
1. Open http://localhost:9090
2. Query examples:
   - `be_api_generic_http_requests_total` - Total requests
   - `be_api_generic_http_request_duration_ms` - Request durations
   - `be_api_generic_http_errors_total` - Error counts
   - `rate(be_api_generic_http_requests_total[5m])` - Request rate

### Loki Log Queries
In Grafana, use the Explore tab with Loki datasource:

```logql
# All logs from the application
{app="be-api-generic"}

# Filter by log level
{app="be-api-generic"} |= "error"

# Filter by user ID
{app="be-api-generic"} | json | userId="user-123"

# Filter by status code
{app="be-api-generic"} | json | statusCode >= 400

# Filter by endpoint
{app="be-api-generic"} | json | uri="/api/users"

# Show slow requests (> 1000ms)
{app="be-api-generic"} | json | elapsedTime > 1000
```

## Configuration

### Loki Configuration
Located at `monitoring/loki/config.yaml`:
- Retention period: 168 hours (7 days)
- Max query entries: 5000
- Ingestion rate limit: 10 MB/s

### Promtail Configuration
Located at `monitoring/promtail/config.yaml`:
- Scrapes logs from `/var/log/be-api-generic/*.log`
- Parses JSON logs and extracts labels
- Ships logs to Loki

### Grafana Provisioning
- Datasources: `monitoring/grafana/provisioning/datasources/`
- Dashboards: `monitoring/grafana/provisioning/dashboards/`
- Pre-configured dashboard: `monitoring/grafana/dashboards/api-monitoring.json`

### Prometheus Configuration
Located at `monitoring/prometheus/prometheus.yml`:
- Scrapes metrics from:
  - Node exporter (system metrics)
  - Application `/metrics` endpoint
  - Loki and Grafana

## Log Format

Logs are structured in JSON format:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "GET /api/users 200 45ms [User: user-123]",
  "requestId": "uuid-v4",
  "userId": "user-123",
  "method": "GET",
  "uri": "/api/users?page=1",
  "statusCode": 200,
  "requestBody": { ... },
  "responseBody": { ... },
  "elapsedTime": 45,
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.1"
}
```

## Security Considerations

### Sensitive Data Protection
By default (`LOG_SENSITIVE_DATA=false`), the following fields are automatically redacted:
- password
- token
- secret
- authorization
- cookie
- creditCard
- ssn

Example:
```json
{
  "requestBody": {
    "email": "user@example.com",
    "password": "[REDACTED]"
  }
}
```

### Production Recommendations
1. Use strong passwords for Grafana admin account
2. Enable HTTPS for all services
3. Restrict access to monitoring endpoints
4. Use authentication for Prometheus and Loki endpoints
5. Configure appropriate retention policies
6. Set up alerts for critical metrics
7. Use external storage for production Loki data

## Troubleshooting

### Logs not appearing in Grafana
1. Check if Loki is running: `docker-compose ps`
2. Verify Loki is receiving logs: `curl http://localhost:3100/ready`
3. Check Promtail logs: `docker-compose logs promtail`
4. Ensure log files exist: `ls -la ../be-api-generic/logs/`
5. Verify LOKI_URL in application: `echo $LOKI_URL`

### Metrics not working
1. Check if Prometheus is running: `curl http://localhost:9090/-/healthy`
2. Verify metrics endpoint: `curl http://localhost:3000/metrics`
3. Check Prometheus targets: http://localhost:9090/targets

### Container issues
```bash
# View all container logs
docker-compose logs -f

# Restart all services
docker-compose restart

# Reset everything (WARNING: removes data)
docker-compose down -v
docker-compose up -d
```

## Advanced Usage

### Custom Alerts
Create alert rules in Grafana:
1. Navigate to Alerting → Alert rules
2. Create new alert rule
3. Example: Alert when error rate > 5%
   ```
   sum(rate(be_api_generic_http_errors_total[5m]))
   /
   sum(rate(be_api_generic_http_requests_total[5m]))
   > 0.05
   ```

### Custom Dashboards
1. Create new dashboard in Grafana
2. Add panels with custom queries
3. Save and export as JSON
4. Place in `monitoring/grafana/dashboards/`

### Log Export
Export logs from Loki:
```bash
# Export last hour of logs
curl -G -s "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={app="be-api-generic"}' \
  --data-urlencode 'start='$(date -u -d '1 hour ago' +%s)'000000000' \
  --data-urlencode 'end='$(date +%s)'000000000' \
  > logs_export.json
```

## Maintenance

### Log Rotation
Application logs are automatically rotated:
- Max file size: 5MB
- Max files: 5
- Location: `be-api-generic/logs/`

### Data Cleanup
Loki automatically cleans up old data based on retention policy (7 days default).

To manually clean:
```bash
# Stop services
docker-compose down

# Remove volumes
docker volume rm monitoring_loki_data
docker volume rm monitoring_grafana_data
docker volume rm monitoring_prometheus_data

# Restart
docker-compose up -d
```

## Performance Impact

The logging system is designed for minimal performance impact:
- Async logging to avoid blocking requests
- Efficient JSON serialization
- Configurable log levels
- Optional request/response body logging
- In-memory metrics with minimal overhead

Typical overhead:
- CPU: < 2% increase
- Memory: ~50MB for logging buffers
- Latency: < 1ms per request

## License

MIT