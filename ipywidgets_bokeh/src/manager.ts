import * as base from "@jupyter-widgets/base"
import * as outputWidgets from "@jupyter-widgets/output"
import * as controls from "@jupyter-widgets/controls"

import {HTMLManager} from "@jupyter-widgets/html-manager"
import type {WidgetModel, WidgetView, IModelOptions} from "@jupyter-widgets/base"
import {shims} from "@jupyter-widgets/base"
import type {IState, IManagerState} from "@jupyter-widgets/base-manager"

import type {Kernel, ServerConnection} from "@jupyterlab/services"
import {KernelManager} from "@jupyterlab/services"

import {assert} from "@bokehjs/core/util/assert"
import {isString} from "@bokehjs/core/util/types"
import {keys, entries, to_object} from "@bokehjs/core/util/object"

abstract class CommsWebSocket implements WebSocket {
  binaryType: BinaryType

  readonly bufferedAmount: number
  readonly extensions: string
  readonly protocol: string
  readonly readyState: number

  readonly CONNECTING: 0 = 0
  readonly OPEN: 1 = 1
  readonly CLOSING: 2 = 2
  readonly CLOSED: 3 = 3

  static readonly CONNECTING: 0 = 0
  static readonly OPEN: 1 = 1
  static readonly CLOSING: 2 = 2
  static readonly CLOSED: 3 = 3

  readonly url: string

  constructor(url: string | URL, _protocols?: string | string[]) {
    this.url = url instanceof URL ? url.toString() : url
  }

  close(code?: number, reason?: string): void {
    const event = new CloseEvent("close", {code, reason})
    this.onclose?.(event)
  }

  abstract send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void

  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null
  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null

  addEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions): void {
    throw new Error("not implemented")
  }
  removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | EventListenerOptions): void {
    throw new Error("not implemented")
  }
  dispatchEvent(_event: Event): boolean {
    throw new Error("not implemented")
  }
}

export type ModelBundle = {
  spec: {model_id: string}
  state: IManagerState
}

let _kernel_id = 0

type KernelConnection = Kernel.IKernelConnection & {
  // This is probably a private member of IKernelConnection, but there's
  // no public API to retrieve a Comm, only to check if one exists.
  _comms: Map<string, Kernel.IComm>
}

export class WidgetManager extends HTMLManager {

  private _known_models: Map<string, IState> = new Map()
  private kernel_manager: KernelManager
  private kernel: Kernel.IKernelConnection
  private ws: WebSocket | null = null
  private _model_objs: Map<string, WidgetModel> = new Map()

  bk_send?: (data: string | ArrayBuffer) => void

  bk_open(send_fn: (data: string | ArrayBuffer) => void): void {
    if (this.ws != null) {
      this.bk_send = send_fn
      this.ws.onopen?.(new Event("open"))
    }
  }

  bk_recv(data: string | ArrayBuffer): void {
    if (this.ws != null) {
      this.ws.onmessage?.(new MessageEvent("message", {data}))
    }
  }

  private _comms: Map<string, Kernel.IComm> = new Map()

  constructor(options: any) {
    super(options)

    const manager = this
    const settings: ServerConnection.ISettings = {
      appendToken: false,
      baseUrl: "",
      appUrl: "",
      wsUrl: "",
      token: "",
      init: {cache: "no-store", credentials: "same-origin"},
      fetch: async (_input: RequestInfo, _init?: RequestInit): Promise<Response> => {
        // returns an empty list of kernels to make KernelManager happy
        return new Response("[]", {status: 200})
      },
      Headers,
      Request,
      WebSocket: class extends CommsWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols)
          manager.ws = this
        }

        send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
          if (isString(data) || data instanceof ArrayBuffer) {
            manager.bk_send?.(data)
          } else {
            console.error(`only string and ArrayBuffer types are supported, got ${typeof data}`)
          }
        }
      },
    }

    this.kernel_manager = new KernelManager({serverSettings: settings})
    const kernel_model: Kernel.IModel = {name: "bokeh_kernel", id: `${_kernel_id++}`}
    this.kernel = this.kernel_manager.connectTo({model: kernel_model, handleComms: true})
    this.kernel.registerCommTarget(this.comm_target_name, (comm, msg) => {
      const model = this._model_objs.get(msg.content.comm_id)
      const comm_wrapper = new shims.services.Comm(comm)
      if (model == null) {
        void this.handle_comm_open(comm_wrapper, msg).then((model) => {
          if (!model.comm_live) {
            const comm_wrapper = new shims.services.Comm(comm)
            this._attach_comm(comm_wrapper, model)
          }
        })
      } else {
        this._attach_comm(comm_wrapper, model)
      }
      this._model_objs.delete(msg.content.comm_id)
    })
  }

  _attach_comm(comm: any, model: WidgetModel) {
    model.comm = comm

    // Hook comm messages up to model.
    comm.on_close(model._handle_comm_closed.bind(model))
    comm.on_msg(model._handle_comm_msg.bind(model))

    model.comm_live = true
  }

  async render(bundle: ModelBundle, el: HTMLElement): Promise<WidgetView | null> {
    const {spec, state} = bundle
    const new_models = state.state
    for (const [id, new_model] of entries(new_models)) {
      this._known_models.set(id, new_model)
    }

    try {
      const models = await this.set_state(state)
      await this.set_state({...state, state: state.full_state as any})
      for (const model of models) {
        if (this._model_objs.has(model.model_id)) {
          continue
        }
        const comm = await this._create_comm(this.comm_target_name, model.model_id)
        this._attach_comm(comm, model)
        this._model_objs.set(model.model_id, model)
        model.once("comm:close", () => {
          this._model_objs.delete(model.model_id)
        })
      }

      const model = models.find((item) => item.model_id == spec.model_id)
      if (model == null) {
        return null
      }

      const view = await this.create_view(model, {el})
      await this.display_view(view, el)
      return view
    } finally {
      for (const id of keys(new_models)) {
        this._known_models.delete(id)
      }
    }
  }

  override async _create_comm(target_name: string, model_id: string, data?: any, metadata?: any,
      buffers?: ArrayBuffer[] | ArrayBufferView[]): Promise<shims.services.Comm> {
    const comm = (() => {
      const key = `${target_name}${model_id}`
      let comm = this._comms.get(key)
      if (comm === undefined) {
        if (this.kernel.hasComm(model_id)) {
          comm = (this.kernel as KernelConnection)._comms.get(model_id)
        } else {
          comm = this.kernel.createComm(target_name, model_id)
        }
        assert(comm != null)
        this._comms.set(key, comm)
      }
      return comm
    })()
    comm.open(data, metadata, buffers)
    return new shims.services.Comm(comm)
  }

  override _get_comm_info(): Promise<{}> {
    return Promise.resolve(to_object(this._known_models))
  }

  override async new_model(options: IModelOptions, serialized_state?: any): Promise<WidgetModel> {
    // XXX: this is a hack that allows to connect to a live comm and use initial
    // state sent via a state bundle, essentially turning new_model(modelCreate)
    // into new_model(modelCreate, modelState) in ManagerBase.set_state(), possibly
    // breaking safe guard rule (1) of that method. This is done this way to avoid
    // reimplementing set_state().
    if (serialized_state === undefined) {
      const models = this._known_models
      const {model_id} = options
      if (model_id != null && models.has(model_id)) {
        const model = models.get(model_id)!
        serialized_state = model.state
      } else {
        throw new Error("internal error in new_model()")
      }
    }
    return super.new_model(options, serialized_state)
  }

  protected override loadClass(
    className: string,
    moduleName: string,
    moduleVersion: string,
  ): Promise<typeof WidgetModel | typeof WidgetView> {
    return new Promise((resolve, reject) => {
      if (moduleName === "@jupyter-widgets/base") {
        resolve(base)
      } else if (moduleName === "@jupyter-widgets/controls") {
        resolve(controls)
      } else if (moduleName === "@jupyter-widgets/output") {
        resolve(outputWidgets)
      } else if (this.loader !== undefined) {
        resolve(this.loader(moduleName, moduleVersion))
      } else {
        reject(`Could not load module ${moduleName}@${moduleVersion}`)
      }
    }).then((module) => {
      if ((module as any)[className]) {
        return (module as any)[className]
      } else {
        return Promise.reject(`Class ${className} not found in module ${moduleName}@${moduleVersion}`)
      }
    })
  }

}
