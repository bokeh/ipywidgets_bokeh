import asyncio

import pytest
from panel.tests.conftest import server_cleanup  # noqa: F401


@pytest.fixture
def asyncio_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(asyncio.new_event_loop())
    yield
    loop.stop()
    loop.close()
