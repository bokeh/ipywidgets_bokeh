import {HTMLManager} from "@jupyter-widgets/html-manager"
import {ModelOptions, IClassicComm, shims} from "@jupyter-widgets/base"
import * as utils from "@jupyter-widgets/base"
import {Kernel, KernelManager, ServerConnection} from "@jupyterlab/services"

import {isString} from "@bokehjs/core/util/types"

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

export type ModelBundle = {
  spec: {model_id: string}
  state: State
}

export type State = {
  version_major?: number
  state: {[key: string]: ModelState}
}

let _kernel_id = 0

export class WidgetManager extends HTMLManager {

  private _known_models: {[key: string]: ModelState} = {}
  private kernel_manager: KernelManager
  private kernel: Kernel.IKernelConnection
  private ws: WebSocket | null = null

  protected bk_send?: (data: string | ArrayBuffer) => void

  make_WebSocket() {
    const manager = this
    return class PseudoWebSocket implements WebSocket {
      binaryType: BinaryType

      readonly bufferedAmount: number
      readonly extensions: string
      readonly protocol: string
      readonly readyState: number

      readonly CLOSED: number = 0
      readonly CLOSING: number = 1
      readonly CONNECTING: number = 2
      readonly OPEN: number = 3

      static readonly CLOSED: number = 0
      static readonly CLOSING: number = 1
      static readonly CONNECTING: number = 2
      static readonly OPEN: number = 3

      constructor(readonly url: string, _protocols?: string | string[]) {
        manager.ws = this
      }

      close(code?: number, reason?: string): void {
        const event = new CloseEvent("close", {code, reason})
        this.onclose?.(event)
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (isString(data) || data instanceof ArrayBuffer) {
          manager.bk_send?.(data)
        } else {
          console.error(`only string and ArrayBuffer types are supported, got ${typeof data}`)
        }
      }

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
  }

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

  private _comms: Map<string, any /* Comm */> = new Map()

  constructor(options: any) {
    super(options)

    const settings: ServerConnection.ISettings = {
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
      WebSocket: this.make_WebSocket(),
      appendToken: false,
    };

    this.kernel_manager = new KernelManager({serverSettings: settings})
    const kernel_model: Kernel.IModel = {name: "bokeh_kernel", id: `${_kernel_id++}`}
    this.kernel = this.kernel_manager.connectTo({model: kernel_model, handleComms: true})

    this.kernel.registerCommTarget(this.comm_target_name, (comm, msg) => {
      this.handle_comm_open(new shims.services.Comm(comm), msg)
    })
  }

  async render(bundle: ModelBundle, el: HTMLElement): Promise<void> {
    const {spec, state} = bundle
    const new_models = state.state
    for (const id in new_models) {
      this._known_models[id] = new_models[id]
    }
    try {
      const models = await this.set_state(state)
      const model = models.find((item) => item.model_id == spec.model_id)
      if (model != null) {
        await this.display_model(undefined as any, model, {el})
      }
    } finally {
      for (const id in new_models) {
        delete this._known_models[id]
      }
    }
  }

  async _create_comm(target_name: string, model_id: string, data?: any, metadata?: any,
      buffers?: ArrayBuffer[] | ArrayBufferView[]): Promise<IClassicComm> {
    const comm = (() => {
      const key = target_name + model_id
      if (this._comms.has(key))
        return this._comms.get(key)
      else {
        const comm = this.kernel.createComm(target_name, model_id)
        this._comms.set(key, comm)
        return comm
      }
    })()
    if (data || metadata) {
      comm.open(data, metadata, buffers)
    }
    return new shims.services.Comm(comm)
  }

  _get_comm_info(): Promise<any> {
    return Promise.resolve(this._known_models)
  }

  async new_model(options: ModelOptions, serialized_state?: any): Promise<WidgetModel> {
    // XXX: this is a hack that allows to connect to a live comm and use initial
    // state sent via a state bundle, essentially turning new_model(modelCreate)
    // into new_model(modelCreate, modelState) in ManagerBase.set_state(), possibly
    // breaking safe guard rule (1) of that method. This is done this way to avoid
    // reimplementing set_state().
    if (serialized_state === undefined) {
      const models = this._known_models
      const {model_id} = options
      if (model_id != null && models[model_id] != null) {
        const model = models[model_id]
        serialized_state = model.state
      } else
        throw new Error("internal error in new_model()")
    }
    return super.new_model(options, serialized_state)
  }
}
