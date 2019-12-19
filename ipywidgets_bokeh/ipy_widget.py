#-----------------------------------------------------------------------------
# Copyright (c) 2012 - 2019, Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

from bokeh.core.properties import Any
from bokeh.models.layouts import HTMLBox

from ipywidgets import embed, Widget

class IPyWidget(HTMLBox):

    __javascript__ = [
        "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.4/require.min.js",
        "http://localhost:5006/static/js/jupyter_embed/jupyter_embed.js",
        #"https://unpkg.com/@bokeh/jupyter_embed",
    ]

    bundle = Any()

    def __init__(self, *, widget=None, **kwargs):
        super().__init__(**kwargs)
        from .kernel import kernel
        kernel._bk_register(self, widget)
        spec = widget.get_view_spec()
        state = Widget.get_manager_state(widgets=[])
        state["state"] = embed.dependency_state([widget], drop_defaults=True)
        self.bundle = dict(spec=spec, state=state)

    #def _attach_document(self, doc):
    #    super()._attach_document(doc)

    #def _detach_document(self):
    #    super()._detach_document()
