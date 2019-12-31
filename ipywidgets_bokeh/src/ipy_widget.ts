import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {Document} from "@bokehjs/document"
import {MessageSentEvent} from "@bokehjs/document/events"
import * as p from "@bokehjs/core/properties"

import {create_widget_manager, WidgetManager} from "./ipy_manager"

const widget_managers: WeakMap<Document, Promise<WidgetManager>> = new WeakMap()

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
    const manager = await widget_managers.get(this.model.document!)!
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

  static __module__ = "ipywidgets_bokeh.ipy_widget"

  static init_IPyWidget(): void {
    this.prototype.default_view = IPyWidgetView

    this.define<IPyWidget.Props>({
      bundle: [ p.Any ],
    })
  }

  protected _doc_attached(): void {
    const doc = this.document!

    let widget_manager = widget_managers.get(doc)
    if (widget_manager == null) {
      widget_manager = create_widget_manager()
      widget_managers.set(doc, widget_manager)

      widget_manager.then((manager) => {
        manager.kernel.bk_send = (data: string | ArrayBuffer): void => {
          const event = new MessageSentEvent(doc, "ipywidgets_bokeh", data)
          doc._trigger_on_change(event)
        }

        doc.on_message("ipywidgets_bokeh", (data: unknown) => {
          manager.kernel.bk_recv({data})
        })
      })
    }
  }
}
