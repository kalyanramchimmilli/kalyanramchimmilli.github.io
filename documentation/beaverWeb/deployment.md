---
sidebar_position: 6
title: Deployment
---

# Deployment

BeaverWeb runs as a standalone Python process. This page covers the standard patterns for concurrency, TLS termination, and service management.

## Concurrency

`app.run()` handles requests through a `ThreadPoolExecutor`. By default the pool is capped at 50 concurrent workers; requests beyond the cap are queued until a worker is available.

The cap is configurable:

```python
if __name__ == "__main__":
    app.run(max_workers=200)
```

Workers are allocated lazily — the pool does not preallocate threads. If the server only ever handles three concurrent requests, only three worker threads are created. Threads are reused across requests, eliminating per-request thread-creation overhead.

**Workload sizing:**

- **I/O-bound** (database queries, upstream HTTP calls, file reads): scale threads high. The GIL is released during I/O, so additional threads translate directly into additional parallel I/O.
- **CPU-bound**: cap around `os.cpu_count()`. The GIL serializes CPU-bound Python code across threads.

## TLS termination via reverse proxy

BeaverWeb serves plain HTTP. Terminate TLS at a reverse proxy:

```
Client → nginx (TLS) → BeaverWeb (HTTP on 127.0.0.1)
```

Minimum nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Bind BeaverWeb to `127.0.0.1` so external clients can only reach it through the proxy:

```python
app.run(host="127.0.0.1", port=5000, max_workers=200)
```

## Running as a systemd service

A minimal `systemd` unit for Linux:

```ini
[Unit]
Description=BeaverWeb application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/srv/myapp
ExecStart=/srv/myapp/.venv/bin/python app.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable myapp
sudo systemctl start myapp
```

Logs are available through `journalctl -u myapp -f`.

## Logging

BeaverWeb writes access logs and error tracebacks through Python's `logging` module under the `"beaver"` logger name. Attach handlers or configure log levels from the application:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
```

Access log lines follow this format:

```
127.0.0.1 - "GET /users/42" 200
```

Handler exceptions and parse failures are logged with full tracebacks at `ERROR` level.

## Current limitations

The following features are on the roadmap and not yet supported:

- **HTTP keep-alive.** Every request opens and closes its own connection. Deploy a connection-pooling proxy for high-throughput workloads.
- **`Transfer-Encoding: chunked` request bodies.** Requests without `Content-Length` are treated as having empty bodies.
- **Graceful shutdown.** Ctrl+C terminates in-flight requests immediately; workers are daemon threads by design.
- **Code hot-reload.** The application process must be restarted to load code changes. Jinja2 templates auto-reload when their source files change.

## Health checks and readiness

Register a route for load-balancer health probes:

```python
@app.get("/healthz")
def healthz(req):
    return Response("ok")
```

Point the load balancer or orchestrator at this endpoint. Any non-2xx response signals an unhealthy state.
