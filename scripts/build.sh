#!/bin/bash

set -e
set -x

cd ipywidgets_bokeh/
npm install
npm run build
cd ..

python setup.py build_js sdist bdist_wheel

conda build conda.recipe
