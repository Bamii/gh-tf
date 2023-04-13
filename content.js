// const me = require("./morphdom.min.js")

(async function() {
  const _import = async (file) => {
    const src = chrome.runtime.getURL(file);
    return import(src);
  }

  const me = await _import("./filetree.js")
  const Filetree = me.FileTree;
  const filetree = new Filetree(document, {
    set_code: (code) => {
      chrome.runtime.sendMessage(`code ${code}`);
    },
    get_code: () => {
      chrome.runtime.sendMessage("get-code ")
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    const [operation, details] = message.split(" ");

    switch (operation) {
      case "url":
        filetree.load_new_page(details);
        break;

      case "code":
        filetree.set_token(details);
        break;
    
      default:
        break;
    }
  })
})()

