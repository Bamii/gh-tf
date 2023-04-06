// const me = require("./morphdom.min.js")

(async function() {
  const _import = async (file) => {
    const src = chrome.runtime.getURL(file);
    return import(src);
  }

  const me = await _import("./filetree.js")
  me.default(document);

  chrome.runtime.onMessage.addListener((message) => {
    me.load_new_page(message);
    console.log(message, "yayyyyy")
  })
})()

