import {HTMLManager} from "@jupyter-widgets/html-manager"
import {IClassicComm, shims} from "@jupyter-widgets/base"
import * as pWidget from "@phosphor/widgets"
import * as utils from "@jupyter-widgets/base"

import {DefaultKernel} from "./kernel"

export type WidgetModel = utils.DOMWidgetModel

export type Buffer = {
  path: (string | number)[]
  data: string
  encoding: "hex" | "base64"
}

export type ModelState = {
  model_name: string
  model_module: string
  model_module_version: string
  state: object
  buffers: Buffer[]
}

export type State = {
  version_major?: number
  state: {[key: string]: ModelState}
}

export class WidgetManager extends HTMLManager {

  private _last_state: any
  kernel: DefaultKernel

  constructor(options: any) {
    super(options)

    this.kernel = new DefaultKernel()
    this.kernel.registerCommTarget(this.comm_target_name, (comm, msg) => {
      this.handle_comm_open(new shims.services.Comm(comm), msg)
    })
  }

  async render(bundle: {spec: {model_id: string}, state: State}, el: HTMLElement): Promise<void> {
    const {spec, state} = bundle
    this._last_state = state
    try {
      const models = await this.set_state(state)
      const model = models.find((item) => item.model_id == spec.model_id)
      if (model != null) {
        await this.display_model(undefined as any, model, {el})
      }
    } finally {
      this._last_state = null
    }
  }

  async _create_comm(target_name: string, model_id: string, data?: any, metadata?: any,
      buffers?: ArrayBuffer[] | ArrayBufferView[]): Promise<IClassicComm> {
    const comm = this.kernel.connectToComm(target_name, model_id)
    if (data || metadata) {
      comm.open(data, metadata, buffers)
    }
    return new shims.services.Comm(comm)
  }

  _get_comm_info() {
    return Promise.resolve(this._last_state.state)
  }

  display_view(_msg: any, view: any, options: {el: HTMLElement}): Promise<any> {
    return Promise.resolve(view).then(view => {
      pWidget.Widget.attach(view.pWidget, options.el)
      view.on("remove", () => { console.log("view removed", view) })
      return view
    })
  }

  loadClass(className: string, moduleName: string, moduleVersion: string): any {
    return super.loadClass(className, moduleName, moduleVersion)
  }

  set_state(state: State): Promise<WidgetModel[]> {
    this._last_state = state
    // Check to make sure that it"s the same version we are parsing.
    if (!(state.version_major && state.version_major <= 2)) {
      throw new Error("Unsupported widget state format")
    }
    const models = state.state
    // Recreate all the widget models for the given widget manager state.
    const all_models = this._get_comm_info().then((live_comms) => {
      return Promise.all(Object.keys(models).map((model_id) => {
        // First put back the binary buffers
        const decode = {base64: utils.base64ToBuffer, hex: utils.hexToBuffer}
        const model = models[model_id]
        const model_state = model.state
        if (model.buffers) {
          const buffer_paths = model.buffers.map((b) => b.path)
          // put_buffers expects buffers to be DataViews
          const buffers = model.buffers.map((b) => new DataView(decode[b.encoding](b.data)))
          utils.put_buffers(model.state, buffer_paths, buffers)
        }
        // If the model has already been created, set its state and then
        // return it.
        const promise = this.get_model(model_id)
        if (promise != null) {
          return promise.then((model) => {
            // deserialize state
            return (model.constructor as any)._deserialize_state(model_state || {}, this).then((attributes: any) => {
              model.set_state(attributes)
              return model
            })
          })
        }
        const model_create = {
          model_id: model_id,
          model_name: model.model_name,
          model_module: model.model_module,
          model_module_version: model.model_module_version
        }
        if (live_comms.hasOwnProperty(model_id)) {
          // This connects to an existing comm if it exists, and
          // should *not* send a comm open message.
          return this._create_comm(this.comm_target_name, model_id).then((comm) => {
            return this.new_model({...model_create, comm}, model_state)
          })
        }
        else {
          return this.new_model(model_create, model_state)
        }
      }))
    })
    return all_models
  }
}
