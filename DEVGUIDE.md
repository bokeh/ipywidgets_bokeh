# Release process

## Update package version

| File                            | Entry                    | Content        |
| ------------------------------- | ------------------------ | -------------- |
| `ipywidgets_bokeh/__init__.py`  | `__version__`            | `1.0.0dev1`    |
| `ipywidgets_bokeh/kernel.py`    | `implementation_version` | `1.0.0dev1`    |
| `ipywidgets_bokeh/package.json` | `version`                | `1.0.0-dev.1`  |
| `setup.py`                      | `version`                | `1.0.0dev1`    |
