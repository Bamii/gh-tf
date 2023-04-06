// const me = require("./morphdom.min.js")

(async function() {
  const _import = async (file) => {
    const src = chrome.runtime.getURL(file);
    return import(src);
  }

  const me = await _import("./filetree.js")
  const Filetree = me.FileTree;
  const filetree = new Filetree(document);

  chrome.runtime.onMessage.addListener((message) => {
    filetree.load_new_page(message);
  })
})()

