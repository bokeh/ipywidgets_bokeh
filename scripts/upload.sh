#!/bin/bash

set -e
set -x

PKG=$(conda build conda.recipe --output)
anaconda --token ~/.tokens/anaconda upload -u bokeh -l dev -l main $PKG
