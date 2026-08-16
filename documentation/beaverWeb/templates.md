---
sidebar_position: 5
title: Templates
---

# Templates

BeaverWeb ships with Jinja2 templating built in.

## Directory layout

By default, templates are loaded from a `templates/` directory alongside the application:

```
your-project/
├── app.py
└── templates/
    ├── index.html
    ├── users.html
    └── ...
```

## Rendering a template

```python
@app.get("/")
def home(req):
    return app.render_template("index.html", name="World")
```

`render_template(name, status=200, headers=None, **context)` loads `templates/index.html`, renders it with the provided context, and returns an `HTMLResponse`.

Inside `index.html`:

```html
<h1>Hello, {{ name }}!</h1>
```

## Custom templates directory

To use a directory other than `templates/`:

```python
app = App(templates_dir="views")
```

The path is resolved relative to the application's working directory at runtime.

## Loops, conditionals, and inheritance

Standard Jinja2 syntax is supported. Loop over a list:

```html
<ul>
{% for item in items %}
    <li>{{ item }}</li>
{% endfor %}
</ul>
```

Conditional rendering:

```html
{% if user %}
    <p>Logged in as {{ user }}</p>
{% else %}
    <p><a href="/login">Log in</a></p>
{% endif %}
```

Template inheritance places common structure in `base.html`:

```html
<!-- templates/base.html -->
<!DOCTYPE html>
<html>
<head><title>{% block title %}{% endblock %}</title></head>
<body>
    {% block content %}{% endblock %}
</body>
</html>
```

```html
<!-- templates/index.html -->
{% extends "base.html" %}
{% block title %}Home{% endblock %}
{% block content %}<h1>Welcome</h1>{% endblock %}
```

## Error handling

`render_template` raises `FileNotFoundError` when the template does not exist. BeaverWeb's error handling converts this into a 500 response with the traceback recorded in the application logs; the template name is not exposed to the client.

## Serving static assets

BeaverWeb does not include a generic static file handler. For individual assets, register a route that returns the file's bytes:

```python
@app.get("/static/logo.png")
def logo(req):
    with open("static/logo.png", "rb") as f:
        return Response(f.read(), headers={"Content-Type": "image/png"})
```

Reference the asset from a template:

```html
<img src="/static/logo.png" alt="Logo">
```
