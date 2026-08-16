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

Each decorator registers the handler in the routing table under a `(method, path)` key. The handler is returned unchanged — there is no wrapping or proxying.

## Path parameters

Wrap a segment in curly braces to capture it:

```python
@app.get("/users/{id}")
def user_detail(req):
    return JSONResponse({"id": req.path_params["id"]})
```

Multiple parameters are supported:

```python
@app.get("/users/{uid}/posts/{pid}")
def user_post(req):
    return JSONResponse(req.path_params)
```

Captured values are always strings. Coerce inside the handler if a specific type is required:

```python
@app.get("/users/{id}")
def user_detail(req):
    user_id = int(req.path_params["id"])   # raises ValueError on non-numeric input
    ...
```

## Precedence — first registered wins

If two routes could match the same URL, the one registered first is selected:

```python
@app.get("/users/me")           # register static routes first
def me(req):
    return Response("me")

@app.get("/users/{id}")         # dynamic routes second
def by_id(req):
    return Response(f"id={req.path_params['id']}")
```

Result:

- `GET /users/me` → `me` handler
- `GET /users/42` → `by_id` handler

If the order is reversed, `/users/me` is captured as an `id`. Register more specific routes before more generic ones.

## Trailing slashes

BeaverWeb is lenient with trailing and repeated slashes. All of the following resolve to the same route registered as `/hello`:

- `/hello`
- `/hello/`
- `/hello//`

The root path behaves the same way — `/` and `//` both resolve to `@app.get("/")`.

One exception: `//hello` returns 404 because `urllib.parse.urlsplit` treats a leading `//` as a URL authority. This is standard URL parsing behavior.

## Method mismatch — 405 with `Allow`

A request to an unsupported method on a known path returns a 405 with an `Allow` header listing the methods registered for that path:

```
> POST /users/42
< HTTP/1.1 405 Method Not Allowed
< Allow: GET
```

When multiple methods are registered:

```python
@app.get("/x")
def g(req): ...

@app.put("/x")
def p(req): ...

# DELETE /x → 405, "Allow: GET, PUT"
```

## Default error responses

| Case | Response |
|---|---|
| Malformed request (bad HTTP line) | 400 Bad Request |
| Path not registered | 404 Not Found |
| Path registered, wrong method | 405 Method Not Allowed with `Allow` header |
| Handler raises | 500 Internal Server Error (traceback logged) |
