import time

import anywidget
import panel as pn
import traitlets
from panel.io.server import serve
from playwright.sync_api import expect, Page


class CounterWidget(anywidget.AnyWidget):
    """Counter widget example."""

    _esm = """
        export function render(view) {
          let getCount = () => view.model.get("count");
          let button = document.createElement("button");
          button.classList.add("counter-button");
          button.innerHTML = `${getCount()}`;
          button.addEventListener("click", () => {
            view.model.set("count", getCount() + 1);
            view.model.save_changes();
          });
          view.model.on("change:count", () => {
            button.innerHTML = `${getCount()}`;
          });
          view.el.appendChild(button);
        }
    """
    _css = """
        .counter-button {background-color: #ea580c;}
        .counter-button:hover {background-color: #9a3412;}
    """
    count = traitlets.Int(default_value=0).tag(sync=True)


def test_anywidget(page: Page) -> None:
    """Test anywidget button counter example."""
    # Port to run the panel server on.
    port = 5006

    # Create an anywidget button and make it a panel object.
    widget = CounterWidget()
    panels = pn.panel(widget)

    # Serve the button using panel, the time delay is necessary for panel to start and
    # serve the widget.
    serve(panels=panels, port=port, show=False)
    time.sleep(0.2)

    # Go to the page and locate the widget using playwright.
    page.goto(f"http://localhost:{port}")
    button = page.locator(selector=".counter-button")

    # Click the button and monitor the results.
    expect(button).to_have_count(0)
    button.click()
    expect(button).to_have_count(1)
