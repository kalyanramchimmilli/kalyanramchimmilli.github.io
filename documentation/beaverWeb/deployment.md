---
sidebar_position: 6
title: Deployment
---

# Deployment

BeaverWeb runs as a standalone Python process. This page covers the standard patterns for concurrency, TLS termination, and service management.

## Concurrency

`app.run()` handles requests through a `ThreadPoolExecutor`. By default the pool caps at 50 concurrent workers; requests beyond the cap queue until a worker is free.

Tune the cap to match your workload:

```python
if __name__ == "__main__":
    app.run(max_workers=200)
```

Workers are lazy — the pool doesn't preallocate. If your server only ever sees three concurrent requests, only three worker threads exist. Workers are also reused between requests, so there's no per-request thread-creation overhead.

**Workload sizing:**

- **I/O-bound** (database queries, upstream HTTP calls, file reads): scale threads high. The GIL is released during I/O, so additional threads convert directly into additional parallel I/O.
- **CPU-bound**: cap around `os.cpu_count()`. The GIL serializes CPU-bound Python code across threads.

## TLS termination via reverse proxy

BeaverWeb speaks plain HTTP. Terminate TLS at a reverse proxy:

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

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable myapp
sudo systemctl start myapp
```

Logs land in `journalctl -u myapp -f`.

## Logging

BeaverWeb writes access logs and error tracebacks through Python's `logging` module under the `"beaver"` logger name. Attach handlers or set log levels from your application:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
```

Access log lines have the format:

```
127.0.0.1 - "GET /users/42" 200
```

Handler exceptions and parse failures include full tracebacks at `ERROR` level.

## Current limitations

The following features are on the roadmap and not yet supported:

- **HTTP keep-alive.** Every request opens and closes its own connection. Put a connection-pooling proxy in front for high-throughput deployments.
- **`Transfer-Encoding: chunked` request bodies.** Requests without `Content-Length` are treated as empty-bodied.
- **Graceful shutdown.** Ctrl+C terminates in-flight requests immediately. Workers are daemon threads by design.
- **Code hot-reload.** The application process must be restarted to pick up code changes. Jinja2 templates *do* auto-reload on file change.

## Health checks and readiness

Register a trivial route for load-balancer health probes:

```python
@app.get("/healthz")
def healthz(req):
    return Response("ok")
```

Point your load balancer or orchestrator at that endpoint. Any non-2xx response signals unhealthy.
