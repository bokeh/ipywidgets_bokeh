#!/usr/bin/env python

import sys
from os.path import join, dirname
from setuptools import setup, find_packages, Command

ipywidgets_bokeh_dir = join(dirname(__file__), "ipywidgets_bokeh")

class BuildJS(Command):

    description = "compiles the extension with 'bokeh build'"
    user_options = []

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        from bokeh.ext import build
        build(ipywidgets_bokeh_dir)

install_requires = [
    "bokeh >=2.0.0dev5",
    "ipywidgets >=7.5.0",
]

setup_args = dict(
    name="ipywidgets_bokeh",
    version="0.1.2",
    install_requires=install_requires,
    description="Allows embedding of Jupyter widgets in Bokeh layouts.",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Bokeh Team",
    author_email="info@bokeh.org",
    license="BSD-3-Clause",
    url="https://github.com/bokeh/ipywidgets_bokeh",
    packages=find_packages(),
    classifiers=[
        "License :: OSI Approved :: BSD License",
        "Development Status :: 5 - Production/Stable",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Operating System :: OS Independent",
        "Intended Audience :: Science/Research",
        "Intended Audience :: Developers",
        "Natural Language :: English",
        "Topic :: Scientific/Engineering",
        "Topic :: Software Development :: Libraries",
    ],
    cmdclass={"build_js": BuildJS},
    include_package_data=True,
    data_files=[],
)

if __name__ == "__main__":
    setup(**setup_args)
