---
sidebar_position: 1
title: Introduction
---

# BeaverWeb

A lightweight Python micro web framework built for simplicity.

BeaverWeb runs on a native TCP socket loop, parses HTTP into a `Request` object, dispatches to a handler function, and serializes the response back. It ships with routing, path parameters, query-string parsing, Jinja2 templating, and thread-pool concurrency — with Jinja2 as the only third-party dependency.

## Design principles

- **Minimal core.** One `App` class, one request/response cycle. No WSGI, no ASGI, no metaclass indirection.
- **Explicit over implicit.** Handlers receive a `Request` and return a `Response`. No thread-locals, no request context stacks, no global state.
- **Batteries where they matter.** Jinja2 templating is built in, so HTML applications work without extra glue.

## Features

- Decorator-based routing for `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Path parameters via `/users/{id}` syntax, exposed on `req.path_params`
- Query strings parsed into a Flask-style `MultiDict` for multi-value support
- Jinja2 template rendering
- Configurable `ThreadPoolExecutor` for concurrent request handling
- Access logging via Python's `logging` module

## Requirements

- Python 3.10 or newer

## Install

```bash
pip install beaverweb
```

Continue to [Getting Started](./getting-started) to build your first application.
