import {div, InlineStyleSheet, StyleSheetLike} from "@bokehjs/core/dom"
import {LayoutDOM, LayoutDOMView} from "@bokehjs/models/layouts/layout_dom"
import {UIElement} from "@bokehjs/models/ui/ui_element"
import {Document} from "@bokehjs/document"
import {MessageSentEvent} from "@bokehjs/document/events"
import * as p from "@bokehjs/core/properties"
import {isString, isObject} from "@bokehjs/core/util/types"
import {assert} from "@bokehjs/core/util/assert"
import {values} from "@bokehjs/core/util/object"

import {generate_require_loader} from "./loader"
import {WidgetManager, ModelBundle} from "./manager"

import {WidgetView} from "@jupyter-widgets/base"

const widget_managers: WeakMap<Document, WidgetManager> = new WeakMap()

declare type Module = {
  id: string
  loaded: boolean
  exports: {[key: string]: unknown}
}

declare type UseOptions = {
  handler?(css: string): void
}

declare type StyleModule = Module & {
  exports: {
    default: {
      use(options?: UseOptions): void
      unuse(): void
    }
  }
}

declare const __webpack_module_cache__: {[key: string]: Module}

export class IPyWidgetView extends LayoutDOMView {
  container: HTMLDivElement
  override model: IPyWidget

  private rendered: boolean = false
  private ipy_view: WidgetView | null = null

  get child_models(): UIElement[] {
    return []
  }

  protected _ipy_stylesheets(): StyleSheetLike[] {
    const stylesheets: StyleSheetLike[] = []

    function handler(raw_css: string): void {
      const css = raw_css.replace(/:root/g, ":host")
      stylesheets.push(new InlineStyleSheet(css))
    }

    function is_StyleModule(module: Module): module is StyleModule {
      const {exports} = module
      return isObject(exports.default) && "use" in exports.default
    }

    const modules = values(__webpack_module_cache__)
    const css_modules = modules.filter(({id, exports}) => id.endsWith(".css") && "default" in exports)
    const style_modules = css_modules.filter(is_StyleModule)

    for (const module of style_modules) {
      const style = module.exports.default
      try {
        style.use({handler})
      } catch {
        console.error("failed to apply a stylesheet")
      }
    }

    return stylesheets
  }

  override stylesheets(): StyleSheetLike[] {
    return [...super.stylesheets(), ...this._ipy_stylesheets()]
  }

  override render(): void {
    super.render()
    this.container = div({style: "display: contents;"})
    this.shadow_el.append(this.container)
    this._render().then(() => {
      this.invalidate_layout() // TODO: this may be overzealous; probably should be removed
      this.rendered = true
      this.notify_finished()
    })
  }

  override has_finished(): boolean {
    return this.rendered && super.has_finished()
  }

  async _render(): Promise<void> {
    if (this.ipy_view == null) {
      const {document} = this.model
      assert(document != null, "document is null")

      const manager = widget_managers.get(document)
      assert(manager != null, "manager is null")

      this.ipy_view = await manager.render(this.model.bundle, this.container)
    } else {
      this.container.append(this.ipy_view.el)
    }

    if (this.ipy_view != null) {
      this.ipy_view.trigger("displayed", this.ipy_view)
    }
  }
}

export namespace IPyWidget {
  export type Attrs = p.AttrsOf<Props>

  export type Props = LayoutDOM.Props & {
    bundle: p.Property<ModelBundle>
    cdn: p.Property<string>
  }
}

export interface IPyWidget extends IPyWidget.Attrs {}

export class IPyWidget extends LayoutDOM {
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
      bundle: [ Any                         ],
      cdn:    [ String, "https://unpkg.com" ],
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
