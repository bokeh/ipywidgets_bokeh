import "./webpack"

import {IPyWidget} from "./widget"

import {register_models} from "@bokehjs/base"
register_models({IPyWidget})
