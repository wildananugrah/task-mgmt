import { RequestWithId } from '../middleware/request-id';

// In-memory metrics storage (consider using a proper metrics library like prom-client for production)
class MetricsCollector {
  private requestCounts: Map<string, number> = new Map();
  private requestDurations: number[] = [];
  private errorCounts: Map<string, number> = new Map();
  private statusCounts: Map<number, number> = new Map();
  private startTime: number = Date.now();

  recordRequest(method: string, path: string, statusCode: number, duration: number) {
    // Record request count by method and path
    const key = `${method}:${path}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

    // Record duration
    this.requestDurations.push(duration);
    if (this.requestDurations.length > 1000) {
      this.requestDurations.shift(); // Keep only last 1000 durations
    }

    // Record status code count
    this.statusCounts.set(statusCode, (this.statusCounts.get(statusCode) || 0) + 1);

    // Record errors
    if (statusCode >= 400) {
      const errorKey = `${statusCode}:${path}`;
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    }
  }

  getMetrics(): string {
    const uptime = (Date.now() - this.startTime) / 1000;
    const lines: string[] = [];

    // Add header
    lines.push('# HELP be_api_generic_uptime_seconds Application uptime in seconds');
    lines.push('# TYPE be_api_generic_uptime_seconds gauge');
    lines.push(`be_api_generic_uptime_seconds ${uptime}`);
    lines.push('');

    // Request counts
    lines.push('# HELP be_api_generic_http_requests_total Total number of HTTP requests');
    lines.push('# TYPE be_api_generic_http_requests_total counter');
    this.requestCounts.forEach((count, key) => {
      const [method, path] = key.split(':');
      lines.push(`be_api_generic_http_requests_total{method="${method}",path="${path}"} ${count}`);
    });
    lines.push('');

    // Request durations
    if (this.requestDurations.length > 0) {
      const sum = this.requestDurations.reduce((a, b) => a + b, 0);
      const avg = sum / this.requestDurations.length;
      const sorted = [...this.requestDurations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      lines.push('# HELP be_api_generic_http_request_duration_ms HTTP request duration in milliseconds');
      lines.push('# TYPE be_api_generic_http_request_duration_ms summary');
      lines.push(`be_api_generic_http_request_duration_ms{quantile="0.5"} ${p50}`);
      lines.push(`be_api_generic_http_request_duration_ms{quantile="0.95"} ${p95}`);
      lines.push(`be_api_generic_http_request_duration_ms{quantile="0.99"} ${p99}`);
      lines.push(`be_api_generic_http_request_duration_ms_sum ${sum}`);
      lines.push(`be_api_generic_http_request_duration_ms_count ${this.requestDurations.length}`);
      lines.push('');
    }

    // Status code counts
    lines.push('# HELP be_api_generic_http_responses_total Total number of HTTP responses by status code');
    lines.push('# TYPE be_api_generic_http_responses_total counter');
    this.statusCounts.forEach((count, status) => {
      lines.push(`be_api_generic_http_responses_total{status="${status}"} ${count}`);
    });
    lines.push('');

    // Error counts
    lines.push('# HELP be_api_generic_http_errors_total Total number of HTTP errors');
    lines.push('# TYPE be_api_generic_http_errors_total counter');
    this.errorCounts.forEach((count, key) => {
      const [status, path] = key.split(':');
      lines.push(`be_api_generic_http_errors_total{status="${status}",path="${path}"} ${count}`);
    });
    lines.push('');

    // Memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      lines.push('# HELP nodejs_memory_usage_bytes Memory usage in bytes');
      lines.push('# TYPE nodejs_memory_usage_bytes gauge');
      lines.push(`nodejs_memory_usage_bytes{type="rss"} ${memUsage.rss}`);
      lines.push(`nodejs_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}`);
      lines.push(`nodejs_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}`);
      lines.push(`nodejs_memory_usage_bytes{type="external"} ${memUsage.external}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Create global metrics collector instance
export const metricsCollector = new MetricsCollector();

export class MetricsRouter {
  async handle(req: RequestWithId): Promise<Response | null> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === '/metrics' && req.method === 'GET') {
      const metrics = metricsCollector.getMetrics();
      return new Response(metrics, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
        },
      });
    }

    return null;
  }
}

export const metricsRouter = new MetricsRouter();