---
sidebar_position: 4
title: Responses
---

# Responses

Every handler must return a `Response` object (or subclass). BeaverWeb ships five out of the box.

## `Response` — plain text

The default. Body is a string, `Content-Type` is `text/plain; charset=utf-8`.

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

Serializes any JSON-compatible value with `json.dumps`, sets `Content-Type: application/json`.

```python
from beaver import JSONResponse

@app.get("/users/{id}")
def user_detail(req):
    return JSONResponse({"id": req.path_params["id"]})
```

Lists work too:

```python
@app.get("/items")
def list_items(req):
    return JSONResponse([1, 2, 3])
```

## `HTMLResponse` — direct HTML

Same as `Response` but with `Content-Type: text/html; charset=utf-8`.

```python
from beaver import HTMLResponse

@app.get("/page")
def page(req):
    return HTMLResponse("<h1>Hello</h1>")
```

For anything non-trivial, use [templates](./templates) instead of inline HTML.

## `Redirect` — 302 by default

Sets `Location` header and returns an empty body.

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

Convenience subclass:

```python
from beaver import PermanentRedirect

@app.get("/legacy")
def legacy(req):
    return PermanentRedirect("/new")
```

## Binary content

`Response` accepts raw `bytes` too — needed for images, PDFs, or any non-text content:

```python
@app.get("/logo.png")
def logo(req):
    with open("static/logo.png", "rb") as f:
        return Response(f.read(), headers={"Content-Type": "image/png"})
```

`Content-Length` is always computed from the actual byte count — you never need to set it yourself.

## What you can override

| Header | Behavior |
|---|---|
| `Content-Type` | You set it → wins. Not set → uses subclass default. |
| `Content-Length` | Always overwritten with the actual body byte count. |
| Anything else | Passes through as-is. |
