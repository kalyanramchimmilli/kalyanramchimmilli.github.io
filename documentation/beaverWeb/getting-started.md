---
sidebar_position: 2
title: Getting Started
---

# Getting Started

## Install

```bash
pip install beaverweb
```

That pulls in Jinja2 as a dependency. Nothing else.

## Your first app

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

You should see:

```
Listening on 127.0.0.1:5000
```

In another terminal:

```bash
curl http://127.0.0.1:5000/
# → Hello, BeaverWeb!
```

That's the whole hello-world.

## Reading the request

Every handler receives a `Request` object. It has:

- `req.method` — `"GET"`, `"POST"`, etc.
- `req.path` — the URL path (`"/users/42"`)
- `req.headers` — dict of headers, lowercased keys
- `req.query_params` — a `MultiDict` for `?foo=bar&tag=a&tag=b`
- `req.path_params` — dict of captured path variables
- `req.body` — raw bytes of the request body
- `req.json()` — parses body as JSON if `Content-Type: application/json`

Example combining query params and headers:

```python
@app.get("/hello")
def hello(req):
    name = req.query_params.get("name", "stranger")
    ua = req.headers.get("user-agent", "unknown")
    return Response(f"Hello, {name}! You're using {ua}.")
```

## What's next

- [Routing](./routing) — path parameters, precedence rules, 405 handling
- [Responses](./responses) — `JSONResponse`, `HTMLResponse`, `Redirect`
- [Templates](./templates) — rendering HTML with Jinja2
