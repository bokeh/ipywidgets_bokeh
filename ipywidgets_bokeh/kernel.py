#-----------------------------------------------------------------------------
# Copyright (c) 2012 - 2019, Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

import logging
from json import loads

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

    def send(self, stream, msg_or_type, content=None, parent=None, ident=None, buffers=None, track=False, header=None, metadata=None):
        msg = self.msg(msg_or_type, content=content, parent=parent, header=header, metadata=metadata)
        msg['channel'] = stream.channel

        from bokeh.io import curdoc
        from bokeh.document.events import MessageSentEvent

        doc = curdoc()
        doc.on_message("ipywidgets_bokeh", self.receive)

        event = MessageSentEvent(doc, "ipywidgets_bokeh", msg)
        doc._trigger_on_change(event)

    def receive(self, data: str) -> None:
        msg = loads(data)
        msg_serialized = self.serialize(msg)
        if msg['channel'] == 'shell':
            stream = StreamWrapper(msg['channel'])
            msg_list = [ BytesWrap(k) for k in msg_serialized ]
            self.parent.dispatch_shell(stream, msg_list)

class BokehKernel(ipykernel.kernelbase.Kernel):
    implementation = 'ipython'
    implementation_version = '0.1.2'
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
