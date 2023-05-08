#-----------------------------------------------------------------------------
# Copyright (c) 2012 - 2021, Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------
from __future__ import annotations

import json
import logging

from distutils.version import LooseVersion

import ipykernel
import ipykernel.kernelbase
import jupyter_client.session as session

from bokeh.document.events import MessageSentEvent
from ipykernel.comm import CommManager
from tornado.ioloop import IOLoop
from traitlets import Any

kernel_version = LooseVersion(ipykernel.__version__)

SESSION_KEY = b'ipywidgets_bokeh'

class WebsocketStream(object):
    def __init__(self, session: SessionWebsocket):
        self.session = session

class BytesWrap(object):
    def __init__(self, bytes: bytes):
        self.bytes = bytes

class StreamWrapper(object):
    def __init__(self, channel):
        self.channel = channel

    def flush(self, arg):
        pass

class SessionWebsocket(session.Session):

    parent: BokehKernel

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.document.on_message("ipywidgets_bokeh", self.receive)

    def _encode_msg(self, msg: dict[str, Any], buffers: list[bytes]) -> bytes | str:
        packed = self.pack(msg)

        data: bytes | str
        if buffers:
            buffers = [packed] + buffers
            nbufs = len(buffers)

            start = 4*(1 + nbufs)
            offsets = [start]

            for buffer in buffers[:-1]:
                start += len(buffer)
                offsets.append(start)

            u32 = lambda n: n.to_bytes(4, "big")
            items = [u32(nbufs)] + [ u32(offset) for offset in offsets ] + buffers
            data = b"".join(items)
        else:
            data = packed.decode("utf-8")

        return data

    def send(self, stream, msg_type, content=None, parent=None, ident=None, buffers: list[bytes] | None = None, track=False, header=None, metadata=None):
        msg = self.msg(msg_type, content=content, parent=parent, header=header, metadata=metadata)
        msg["channel"] = getattr(stream, "channel", "shell")
        data = self._encode_msg(msg, buffers or [])
        event = MessageSentEvent(self.document, "ipywidgets_bokeh", data)
        self._trigger_change(event)

    def receive(self, data: str) -> None:
        msg = json.loads(data)
        if msg['channel'] == 'shell':
            msg_serialized = self.serialize(msg)
            msg_list = [BytesWrap(k) for k in msg_serialized]
            async def dispatch_shell():
                parent = self.parent
                await parent.dispatch_shell(msg_list)
            if self.document.session_context: # Bokeh Server
                self.document.add_next_tick_callback(dispatch_shell)
            else: # Other Tornado based server
                self.parent.io_loop.add_callback(dispatch_shell)

    @property
    def document(self):
        from bokeh.io import curdoc
        return curdoc()

    def _trigger_change(self, event):
        self.document.callbacks.trigger_on_change(event)


class ShellStream:

    def flush(self, *args):
        pass


class BokehKernel(ipykernel.kernelbase.Kernel):
    implementation = 'ipython'
    implementation_version = '1.4.0'
    banner = 'banner'

    shell_stream = Any(ShellStream(), allow_none=True)

    def __init__(self):
        super(BokehKernel, self).__init__()

        self.session = SessionWebsocket(parent=self, key=SESSION_KEY)
        self.stream = self.iopub_socket = WebsocketStream(self.session)
        self.io_loop = IOLoop.current()

        self.iopub_socket.channel = 'iopub'
        self.session.stream = self.iopub_socket
        self.comm_manager = CommManager(parent=self, kernel=self)
        self.shell = None
        self.log = logging.getLogger("ipywidgets_bokeh")

        comm_msg_types = ['comm_open', 'comm_msg', 'comm_close']
        for msg_type in comm_msg_types:
            self.shell_handlers[msg_type] = getattr(self.comm_manager, msg_type)

    async def _flush_control_queue(self):
        pass

# Do not make kernel instance if an existing kernel is present
# i.e. when we are in an existing Jupyter session
if ipykernel.kernelbase.Kernel._instance is None:
    kernel = BokehKernel.instance()
else:
    kernel = None
