---
sidebar_position: 4
title: Responses
---

# Responses

Every handler must return a `Response` object or one of its subclasses. Five response types ship with BeaverWeb.

## `Response` — plain text

The default response type. The body is a string and `Content-Type` is set to `text/plain; charset=utf-8`.

```python
from beaver import Response

@app.get("/hello")
def hello(req):
    return Response("Hi there")
```

Custom status and headers:

```python
@app.post("/create")
def create(req):
    return Response("created", status=201, headers={"X-Item-Id": "42"})
```

## `JSONResponse` — for APIs

Serializes any JSON-compatible value using `json.dumps` and sets `Content-Type: application/json`.

```python
from beaver import JSONResponse

@app.get("/users/{id}")
def user_detail(req):
    return JSONResponse({"id": req.path_params["id"]})
```

Lists are also supported:

```python
@app.get("/items")
def list_items(req):
    return JSONResponse([1, 2, 3])
```

## `HTMLResponse` — direct HTML

Identical to `Response`, but with `Content-Type` set to `text/html; charset=utf-8`.

```python
from beaver import HTMLResponse

@app.get("/page")
def page(req):
    return HTMLResponse("<h1>Hello</h1>")
```

For non-trivial markup, use [templates](./templates) rather than inline HTML.

## `Redirect` — 302 by default

Sets the `Location` header and returns an empty body.

```python
from beaver import Redirect

@app.get("/old-home")
def old_home(req):
    return Redirect("/")
```

Custom status:

```python
return Redirect("/new-page", status=307)   # temporary redirect, preserves method
```

## `PermanentRedirect` — 301

A convenience subclass for permanent redirects:

```python
from beaver import PermanentRedirect

@app.get("/legacy")
def legacy(req):
    return PermanentRedirect("/new")
```

## Binary content

`Response` also accepts raw `bytes`, which is required for images, PDFs, or any non-text content:

```python
@app.get("/logo.png")
def logo(req):
    with open("static/logo.png", "rb") as f:
        return Response(f.read(), headers={"Content-Type": "image/png"})
```

`Content-Length` is always computed from the actual byte count; it does not need to be set manually.

## Header behavior

| Header | Behavior |
|---|---|
| `Content-Type` | Overrides the subclass default when set explicitly. |
| `Content-Length` | Always overwritten with the actual body byte count. |
| Any other header | Passes through unchanged. |
