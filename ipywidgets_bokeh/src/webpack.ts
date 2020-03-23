const {src} = document.currentScript
const i = src.lastIndexOf("/")
if (i != -1) {
  const url = src.substring(0, i + 1)
  console.log(url)
  __webpack_require__.p = url
}
