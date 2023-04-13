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

x, y, z = np.random.random((3, 1000))
ipv.quickscatter(x, y, z, size=1, marker="sphere")
ipv_plot = ipv.current.figure

bk_x = Slider(start=0, end=360, value=0, step=1, title="x")
bk_y = Slider(start=0, end=360, value=0, step=1, title="y")
bk_z = Slider(start=0, end=360, value=0, step=1, title="z")
bk_vbox = column([bk_x, bk_y, bk_z])

ip_x = ipw.FloatSlider(min=0, max=360, value=0, step=1, description="x")
ip_y = ipw.FloatSlider(min=0, max=360, value=0, step=1, description="y")
ip_z = ipw.FloatSlider(min=0, max=360, value=0, step=1, description="z")

def randomize(button):
    x, y, z = np.random.random((3, 1000))
    scatter = ipv_plot.scatters[0]
    with ipv_plot.hold_sync():
        scatter.x = x
        scatter.y = y
        scatter.z = z

ip_randomize = ipw.Button(description="Randomize")
ip_randomize.on_click(randomize)

ip_vbox = ipw.VBox([ip_x, ip_y, ip_z, ip_randomize])

def change_angle_x(change):
    new = change["new"]
    print(f"change_angle_x: new={new}")
    bk_x.value = round(np.degrees(new))

def change_angle_y(change):
    new = change["new"]
    print(f"change_angle_y: new={new}")
    bk_y.value = round(np.degrees(new))

def change_angle_z(change):
    new = change["new"]
    print(f"change_angle_z: new={new}")
    bk_z.value = round(np.degrees(new))

ipv_plot.observe(change_angle_x, names="anglex")
ipv_plot.observe(change_angle_y, names="angley")
ipv_plot.observe(change_angle_z, names="anglez")

def change_bk_x(_attr, _old, new):
    print(f"change_bk_x: new={new}")
    ip_x.value = new
    ipv_plot.anglex = np.radians(new)
    source.patch(dict(angles=[(0, new)]))

def change_bk_y(_attr, _old, new):
    print(f"change_bk_y: new={new}")
    ip_y.value = new
    ipv_plot.angley = np.radians(new)
    source.patch(dict(angles=[(1, new)]))

def change_bk_z(_attr, _old, new):
    print(f"change_bk_z: new={new}")
    ip_z.value = new
    ipv_plot.anglez = np.radians(new)
    source.patch(dict(angles=[(2, new)]))

bk_x.on_change("value", change_bk_x)
bk_y.on_change("value", change_bk_y)
bk_z.on_change("value", change_bk_z)

def change_ip_x(change):
    new = change["new"]
    print(f"change_ip_x: new={new}")
    bk_x.value = new

def change_ip_y(change):
    new = change["new"]
    print(f"change_ip_y: new={new}")
    bk_y.value = new

def change_ip_z(change):
    new = change["new"]
    print(f"change_ip_z: new={new}")
    bk_z.value = new

ip_x.observe(change_ip_x, names="value")
ip_y.observe(change_ip_y, names="value")
ip_z.observe(change_ip_z, names="value")

bk_hbox = row([bk_vbox, bk_plot])
ip_hbox = ipw.VBox([ip_vbox, ipv_plot])

wrapper = IPyWidget(widget=ip_hbox, width=800, height=300)
layout = column([bk_hbox, wrapper])

doc = curdoc()
doc.add_root(layout)
