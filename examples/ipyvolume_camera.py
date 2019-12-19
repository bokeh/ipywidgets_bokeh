import numpy as np

from bokeh.models import ColumnDataSource, Slider
from bokeh.plotting import figure, curdoc
from bokeh.layouts import row, column

from ipywidgets_bokeh import IPyWidget

import ipywidgets as ipw
import ipyvolume as ipv

bk_plot = figure(
    toolbar_location=None, width=200, height=200,
    x_range=(-1, 5), y_range=(-1, 1),
    x_axis_location=None, y_axis_location=None,
)
source = ColumnDataSource(data=dict(
    x=[0, 2, 4],
    angles=[0, 0, 0],
    colors=["red", "green", "blue"],
))
bk_plot.annular_wedge("x", 0, 0, 0.9, 0, dict(field="angles", units="deg"), fill_color="colors", line_color=None, source=source)

x, y, z = np.random.random((3, 10000))
ipv.quickscatter(x, y, z, size=1, marker="sphere")
ipv_plot = ipv.current.figure

bk_x = Slider(start=0, end=360, value=0, step=1, title="x")
bk_y = Slider(start=0, end=360, value=0, step=1, title="y")
bk_z = Slider(start=0, end=360, value=0, step=1, title="z")
bk_vbox = column([bk_x, bk_y, bk_z])

ip_x = ipw.FloatSlider(min=0, max=360, value=0, step=1, description="x")
ip_y = ipw.FloatSlider(min=0, max=360, value=0, step=1, description="y")
ip_z = ipw.FloatSlider(min=0, max=360, value=0, step=1, description="z")
ip_vbox = ipw.VBox([ip_x, ip_y, ip_z])

def change_anglex(change):
    bk_x.value = round(np.degrees(change["new"]))
def change_angley(change):
    bk_y.value = round(np.degrees(change["new"]))
def change_anglez(change):
    bk_z.value = round(np.degrees(change["new"]))
ipv_plot.observe(change_anglex, names="anglex")
ipv_plot.observe(change_angley, names="angley")
ipv_plot.observe(change_anglez, names="anglez")

def change_bk_x(_attr, _old, new):
    ip_x.value = new
    ipv_plot.anglex = np.radians(new)
    source.patch(dict(angles=[(0, new)]))
def change_bk_y(_attr, _old, new):
    ip_y.value = new
    ipv_plot.angley = np.radians(new)
    source.patch(dict(angles=[(1, new)]))
def change_bk_z(_attr, _old, new):
    ip_z.value = new
    ipv_plot.anglez = np.radians(new)
    source.patch(dict(angles=[(2, new)]))
bk_x.on_change("value", change_bk_x)
bk_y.on_change("value", change_bk_y)
bk_z.on_change("value", change_bk_z)

def change_ip_x(change):
    bk_x.value = change["new"]
def change_ip_y(change):
    bk_y.value = change["new"]
def change_ip_z(change):
    bk_z.value = change["new"]
ip_x.observe(change_ip_x, names="value")
ip_y.observe(change_ip_y, names="value")
ip_z.observe(change_ip_z, names="value")

bk_hbox = row([bk_vbox, bk_plot])
ip_hbox = ipw.HBox([ip_vbox, ipv_plot])

wrapper = IPyWidget(widget=ip_hbox, width=800, height=300)
layout = column([bk_hbox, wrapper])

doc = curdoc()
doc.add_root(layout)
