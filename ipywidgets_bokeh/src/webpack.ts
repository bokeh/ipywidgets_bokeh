declare const __webpack_require__: {p: string}

const script = document.currentScript
if (script instanceof HTMLScriptElement) {
  const {src} = script
  const i = src.lastIndexOf("/")
  if (i != -1) {
    const url = src.substring(0, i + 1)
    console.log(url)
    __webpack_require__.p = url
  }
}

export {}
