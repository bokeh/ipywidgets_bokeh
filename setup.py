#!/usr/bin/env python

import os
import sys
from setuptools import setup, find_packages, Command

class BuildJS(Command):

    description = "runs 'npm install && npm run prepack'"
    user_options = []

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        npm = "npm" if sys.platform != "win32" else "npm.bat"
        os.chdir("ipywidgets_bokeh")
        try:
            self.spawn([npm, "install"])
            self.spawn([npm, "run", "prepack"])
        finally:
            os.chdir("..")

install_requires = [
    "bokeh ==3.*", # TODO 3.2.dev1
    "ipywidgets ==8.*",
    "ipykernel ==6.*,!=6.18.0", # until ipywidgets 8.0.6
]

setup_args = dict(
    name="ipywidgets_bokeh",
    version="1.4.0",
    install_requires=install_requires,
    python_requires=">=3.9",
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
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
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
