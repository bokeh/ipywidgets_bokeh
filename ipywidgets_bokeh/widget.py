#-----------------------------------------------------------------------------
# Copyright (c) 2012 - 2020, Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

from bokeh.core.properties import Any, String
from bokeh.models.layouts import HTMLBox

from ipywidgets import embed, Widget


class IPyWidget(HTMLBox):
    """Wrap an IPyWidget for embedding in a bokeh app.

    Parameters
    ----------
    widget : Widget
        ipywidget to wrap for embedding in a bokeh app
    **kwargs
        All kwargs are passed to bokeh.model.Model except 'cdn', if present.

        The CDN for external JS resources uses the 'cdn' kwarg if set; otherwise use
        self.default_cdn. After initialization (but before rendering), the CDN can be
        set using IPyWidget.set_cdn; see below.

    """

    __javascript__ = [
        "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.4/require.min.js",
    ]

    bundle = Any()
    cdn = String()
    default_cdn = 'https://unpkg.com'

    def __init__(self, *, widget: Widget, **kwargs):
        cdn = kwargs.pop('cdn', self.default_cdn)

        super().__init__(**kwargs)
        spec = widget.get_view_spec()
        state = Widget.get_manager_state(widgets=[])
        state["state"] = embed.dependency_state([widget], drop_defaults=True)
        self.bundle = {'spec': spec, 'state': state}
        self.cdn = cdn
