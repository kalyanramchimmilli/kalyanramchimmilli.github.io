---
sidebar_position: 5
title: Templates
---

# Templates

BeaverWeb comes with Jinja2 templating.

## Directory layout

Templates live in a `templates/` folder next to your app:

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

`render_template(name, status=200, headers=None, **context)` looks up `templates/index.html`, renders it with the given context, and returns an `HTMLResponse`.

Inside `index.html`:

```html
<h1>Hello, {{ name }}!</h1>
```

## Custom templates directory

If you don't want to call your folder `templates/`:

```python
app = App(templates_dir="views")
```

The path is relative to your working directory when you run the app.

## Loops, conditionals, inheritance

Standard Jinja2. Loop over a list:

```html
<ul>
{% for item in items %}
    <li>{{ item }}</li>
{% endfor %}
</ul>
```

Conditional:

```html
{% if user %}
    <p>Logged in as {{ user }}</p>
{% else %}
    <p><a href="/login">Log in</a></p>
{% endif %}
```

Template inheritance — put common structure in `base.html`:

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

`render_template` raises `FileNotFoundError` if the template doesn't exist. BeaverWeb's built-in error handling turns that into a 500 with the traceback in your logs — no template name is leaked to the client.

## Serving static assets

BeaverWeb doesn't ship a generic static file handler yet. For a single file (like a logo), register a route that returns the bytes:

```python
@app.get("/static/logo.png")
def logo(req):
    with open("static/logo.png", "rb") as f:
        return Response(f.read(), headers={"Content-Type": "image/png"})
```

Then reference it in your template:

```html
<img src="/static/logo.png" alt="Logo">
```
