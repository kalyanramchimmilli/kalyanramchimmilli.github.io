---
sidebar_position: 3
title: Routing
---

# Routing

BeaverWeb uses decorators to register handlers. Each decorator pairs an HTTP method with a URL path.

## HTTP method decorators

```python
@app.get("/items")
def list_items(req): ...

@app.post("/items")
def create_item(req): ...

@app.put("/items/{id}")
def replace_item(req): ...

@app.patch("/items/{id}")
def update_item(req): ...

@app.delete("/items/{id}")
def delete_item(req): ...
```

Every decorator returns your handler unchanged — no wrapping, no proxying. It just files the function into the routing table under a `(method, path)` key.

## Path parameters

Wrap a segment in curly braces to capture it:

```python
@app.get("/users/{id}")
def user_detail(req):
    return JSONResponse({"id": req.path_params["id"]})
```

Multiple parameters work too:

```python
@app.get("/users/{uid}/posts/{pid}")
def user_post(req):
    return JSONResponse(req.path_params)
```

Values are always strings. If you need integers, coerce inside the handler:

```python
@app.get("/users/{id}")
def user_detail(req):
    user_id = int(req.path_params["id"])   # will raise ValueError on non-numeric
    ...
```

## Precedence — first registered wins

If two routes could match the same URL, whichever was registered first wins:

```python
@app.get("/users/me")           # <- register static first
def me(req):
    return Response("me")

@app.get("/users/{id}")         # <- dynamic second
def by_id(req):
    return Response(f"id={req.path_params['id']}")
```

Result:

- `GET /users/me` → hits `me` handler
- `GET /users/42` → hits `by_id` handler

Reverse the order and `/users/me` gets captured as an id. Always register more specific routes before more generic ones.

## Trailing slashes

BeaverWeb is **lenient** on trailing and internal slashes. All of these hit the same route registered as `/hello`:

- `/hello`
- `/hello/`
- `/hello//`

Root works similarly — `/` and `//` both hit `@app.get("/")`.

**One exception:** `//hello` returns 404 because `urllib.parse.urlsplit` treats the leading `//` as URL authority. This is standard URL parsing, not a BeaverWeb quirk.

## Method mismatch — 405 with Allow

If you request an unsupported method on a known path, you get a 405 with an `Allow` header listing the methods registered for that path:

```
> POST /users/42
< HTTP/1.1 405 Method Not Allowed
< Allow: GET
```

If multiple methods are registered:

```python
@app.get("/x")
def g(req): ...

@app.put("/x")
def p(req): ...

# DELETE /x → 405, "Allow: GET, PUT"
```

## What you get for free

| Case | Response |
|---|---|
| Malformed request (bad HTTP line) | 400 Bad Request |
| Path not registered | 404 Not Found |
| Path registered, wrong method | 405 Method Not Allowed + `Allow` |
| Handler raises | 500 Internal Server Error (traceback logged) |
