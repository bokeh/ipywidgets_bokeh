#!/bin/bash

set -e
set -x

python scripts/release.py check

cd ipywidgets_bokeh/
npm ci
npm run build
cd ..

python setup.py build_js sdist bdist_wheel

conda build conda.recipe
