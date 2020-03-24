#-----------------------------------------------------------------------------
# Copyright (c) 2012 - 2020, Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

import json
import logging

import ipykernel.kernelbase
import jupyter_client.session as session
from ipykernel.comm import CommManager

SESSION_KEY = b'ipywidgets_bokeh'

class WebsocketStream(object):
    def __init__(self, session):
        self.session = session

class BytesWrap(object):
    def __init__(self, bytes):
        self.bytes = bytes

class StreamWrapper(object):
    def __init__(self, channel):
        self.channel = channel

    def flush(self, arg):
        pass

class SessionWebsocket(session.Session):

    def send(self, stream, msg_type, content=None, parent=None, ident=None, buffers=None, track=False, header=None, metadata=None):
        if buffers is not None and len(buffers) != 0:
            logging.warn("binary buffers aren't supported yet")

        msg = self.msg(msg_type, content=content, parent=parent, header=header, metadata=metadata)
        msg['channel'] = stream.channel

        from bokeh.io import curdoc
        from bokeh.document.events import MessageSentEvent

        doc = curdoc()
        doc.on_message("ipywidgets_bokeh", self.receive)

        data = self.pack(msg).decode("utf-8")
        event = MessageSentEvent(doc, "ipywidgets_bokeh", data)
        doc._trigger_on_change(event)

    def receive(self, data: str) -> None:
        msg = json.loads(data)
        msg_serialized = self.serialize(msg)
        if msg['channel'] == 'shell':
            stream = StreamWrapper(msg['channel'])
            msg_list = [ BytesWrap(k) for k in msg_serialized ]
            self.parent.dispatch_shell(stream, msg_list)

class BokehKernel(ipykernel.kernelbase.Kernel):
    implementation = 'ipython'
    implementation_version = '1.0.0'
    banner = 'banner'

    def __init__(self):
        super(BokehKernel, self).__init__()

        self.session = SessionWebsocket(parent=self, key=SESSION_KEY)
        self.stream = self.iopub_socket = WebsocketStream(self.session)

        self.iopub_socket.channel = 'iopub'
        self.session.stream = self.iopub_socket
        self.comm_manager = CommManager(parent=self, kernel=self)
        self.shell = None
        self.log = logging.getLogger('fake')

        comm_msg_types = ['comm_open', 'comm_msg', 'comm_close']
        for msg_type in comm_msg_types:
            self.shell_handlers[msg_type] = getattr(self.comm_manager, msg_type)

kernel = BokehKernel.instance()
