#-----------------------------------------------------------------------------
# Copyright (c) 2012 - 2020, Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

from bokeh.core.properties import Any, String
from bokeh.models.layouts import LayoutDOM

from ipywidgets import embed, Widget

from .kernel import kernel

class IPyWidget(LayoutDOM):
    """Wrap an IPyWidget for embedding in a bokeh app.

    Parameters
    ----------
    widget : Widget
        ipywidget to wrap for embedding in a bokeh app
    cdn : str
        The CDN for external JS resources.
    **kwargs

    """

    __javascript__ = [
        "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.4/require.min.js",
    ]

    bundle = Any()
    cdn = String(default="https://unpkg.com")

    def __init__(self, *, widget: Widget, **kwargs):
        super().__init__(**kwargs)
        spec = widget.get_view_spec()
        state = Widget.get_manager_state(widgets=[])
        state["state"] = embed.dependency_state([widget], drop_defaults=True)
        self.bundle = dict(spec=spec, state=state)
