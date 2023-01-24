import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {Document} from "@bokehjs/document"
import {MessageSentEvent} from "@bokehjs/document/events"
import * as p from "@bokehjs/core/properties"
import {isString} from "@bokehjs/core/util/types"

import {generate_require_loader} from "./loader"
import {WidgetManager, ModelBundle} from "./manager"

const widget_managers: WeakMap<Document, WidgetManager> = new WeakMap()

export class IPyWidgetView extends HTMLBoxView {
  declare model: IPyWidget

  private rendered: boolean = false

  override render(): void {
    super.render()
    if (!this.rendered) {
      this._render().then(() => {
        this.rendered = true
        this.invalidate_layout()
        this.notify_finished()
      })
    }
  }

  override has_finished(): boolean {
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
    bundle: p.Property<ModelBundle>
    cdn: p.Property<string>
  }
}

export interface IPyWidget extends IPyWidget.Attrs {}

export class IPyWidget extends HTMLBox {
  declare properties: IPyWidget.Props
  declare __view_type__: IPyWidgetView

  constructor(attrs?: Partial<IPyWidget.Attrs>) {
    super(attrs)
  }

  static override __name__ = "IPyWidget"
  static override __module__ = "ipywidgets_bokeh.widget"

  static {
    this.prototype.default_view = IPyWidgetView

    this.define<IPyWidget.Props>(({Any, String}) => ({
      bundle: [ Any ],
      cdn: [ String, "https://unpkg.com" ],
    }))
  }

  protected override _doc_attached(): void {
    const doc = this.document!

    if (!widget_managers.has(doc)) {
      const manager = new WidgetManager({
        loader: generate_require_loader(this.cdn),
      })
      widget_managers.set(doc, manager)

      manager.bk_open((data: string | ArrayBuffer): void => {
        const event = new MessageSentEvent(doc, "ipywidgets_bokeh", data)
        doc._trigger_on_change(event)
      })

      doc.on_message("ipywidgets_bokeh", (data: unknown) => {
        if (isString(data) || data instanceof ArrayBuffer) {
          manager.bk_recv(data)
        } else {
          console.error(`expected a string or ArrayBuffer, got ${typeof data}`)
        }
      })
    }
  }
}
