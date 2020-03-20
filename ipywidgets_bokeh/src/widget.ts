import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {Document} from "@bokehjs/document"
import {MessageSentEvent} from "@bokehjs/document/events"
import * as p from "@bokehjs/core/properties"

import {require_loader} from "./loader"
import {WidgetManager} from "./manager"

const widget_managers: WeakMap<Document, WidgetManager> = new WeakMap()

export class IPyWidgetView extends HTMLBoxView {
  model: IPyWidget

  private rendered: boolean = false

  render(): void {
    super.render()
    if (!this.rendered) {
      this._render().then(() => {
        this.rendered = true
        this.invalidate_layout()
        this.notify_finished()
      })
    }
  }

  has_finished(): boolean {
    return this.rendered && super.has_finished()
  }

  async _render(): Promise<void> {
    const manager = widget_managers.get(this.model.document!)!
    await manager.render(this.model.bundle, this.el)
  }
}

export namespace IPyWidget {
  export type Attrs = p.AttrsOf<Props>

  export type Props = HTMLBox.Props & {
    bundle: p.Property<{spec: {model_id: string}, state: object}>
  }
}

export interface IPyWidget extends IPyWidget.Attrs {}

export class IPyWidget extends HTMLBox {
  properties: IPyWidget.Props

  constructor(attrs?: Partial<IPyWidget.Attrs>) {
    super(attrs)
  }

  static __name__ = "IPyWidget"
  static __module__ = "ipywidgets_bokeh.ipy_widget"

  static init_IPyWidget(): void {
    this.prototype.default_view = IPyWidgetView

    this.define<IPyWidget.Props>({
      bundle: [ p.Any ],
    })
  }

  protected _doc_attached(): void {
    const doc = this.document!

    if (!widget_managers.has(doc)) {
      const manager = new WidgetManager({loader: require_loader})
      widget_managers.set(doc, manager)

      manager.bk_open((data: string | ArrayBuffer): void => {
        const event = new MessageSentEvent(doc, "ipywidgets_bokeh", data)
        doc._trigger_on_change(event)
      })

      doc.on_message("ipywidgets_bokeh", (data: unknown) => {
        manager.bk_recv(data)
      })
    }
  }
}
IPyWidget.init_IPyWidget()
