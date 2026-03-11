#!/bin/bash

# Assumptions:
#
# 1. NPM token is configured in ~/.npmrc
# 2. PyPI user and token is configured in ~/.pypirc
# 3. Anaconda token is configured in ~/.tokens/anaconda

set -e
set -x

git clean -dfx
cd ipywidgets_bokeh/
npm install
npm publish --access public
cd ..

git clean -dfx
python setup.py build_js sdist bdist_wheel
twine upload -u __token__ -p $(cat ~/.tokens/pypi_ipywidgets_bokeh) ./dist/*

git clean -dfx
conda build conda.recipe
PKG=$(conda build conda.recipe --output)
anaconda --token ~/.tokens/anaconda upload -u bokeh -l dev -l main $PKG
