---
sidebar_position: 1
title: Introduction
---

# BeaverWeb

BeaverWeb is a lightweight Python web framework for building small HTTP services with an explicit, minimal surface. Handlers accept a `Request` and return a `Response` — there is no ambient context, no global state, and no framework magic between the socket and your code.

## Features

- Decorator-based routing for `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Path parameters via `/users/{id}` syntax, exposed on `req.path_params`
- Query-string parsing with multi-value support via `MultiDict`
- Jinja2 template rendering
- Configurable `ThreadPoolExecutor` for concurrent request handling
- Access logging via Python's `logging` module

## Requirements

- Python 3.10 or newer

## Install

```bash
pip install beaverweb
```

## Links

- **GitHub:** [kalyanramchimmili/beaverWeb](https://github.com/kalyanramchimmili/beaverWeb)
- **PyPI:** [pypi.org/project/beaverweb](https://pypi.org/project/beaverweb/)

Continue to [Getting Started](./getting-started) to build your first application.

## License

BeaverWeb is released under the MIT License.

```
MIT License

Copyright (c) 2026 Kalyan Ram Chimmili

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OF THE SOFTWARE.
```
