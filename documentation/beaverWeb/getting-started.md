---
sidebar_position: 2
title: Getting Started
---

# Getting Started

## Install

```bash
pip install beaverweb
```

This installs Jinja2 as a dependency. No other third-party packages are required.

## Your first application

Create a file called `app.py`:

```python
from beaver import App, Response

app = App()


@app.get("/")
def home(req):
    return Response("Hello, BeaverWeb!")


if __name__ == "__main__":
    app.run()
```

Run it:

```bash
python app.py
```

The process reports the listening address:

```
Listening on 127.0.0.1:5000
```

In another terminal:

```bash
curl http://127.0.0.1:5000/
# → Hello, BeaverWeb!
```

## Reading the request

Every handler receives a `Request` object with the following attributes:

- `req.method` — the HTTP method (`"GET"`, `"POST"`, etc.)
- `req.path` — the request path (e.g. `"/users/42"`)
- `req.headers` — a dict of headers with lowercased keys
- `req.query_params` — a `MultiDict` of query-string values (supports `?tag=a&tag=b`)
- `req.path_params` — a dict of captured path variables
- `req.body` — the raw request body as bytes
- `req.json()` — parses the body as JSON when `Content-Type: application/json`

Example combining query parameters and headers:

```python
@app.get("/hello")
def hello(req):
    name = req.query_params.get("name", "stranger")
    ua = req.headers.get("user-agent", "unknown")
    return Response(f"Hello, {name}! You're using {ua}.")
```

## Next steps

- [Routing](./routing) — path parameters, precedence rules, 405 handling
- [Responses](./responses) — `JSONResponse`, `HTMLResponse`, `Redirect`
- [Templates](./templates) — rendering HTML with Jinja2
