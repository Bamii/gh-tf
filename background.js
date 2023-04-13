
function dos() {
  document
    .getElementById("gh_ft_menu-container")
    .classList
    .toggle("hidden");
}

chrome.runtime.onInstalled.addListener(async (tab) => {
  try {
    chrome.scripting.insertCSS({
      files: ["./styles.css"],
      target: { tabId: tab.id }
    });
    console.log("finished")
  } catch (error) {
    console.log(error)
  }
});


chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func : dos,
    });
    console.log()
  } catch (error) {
    console.log(error)
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, tab, info) => {
  console.log(tab, info)
  try {
    if(tab.url) {
      await chrome.tabs.sendMessage(
        tabId,
        `url ${tab.url}`,
        {},
        () => {},
      );
    }
    console.log()
  } catch (error) {
    console.log(error)
  }
});

chrome.runtime.onMessage.addListener(async (message) => {
  const [operation, details] = message.split(" ");

  switch (operation) {
    case "code":
      chrome.storage.sync.set("user-token", details);      
      break;

    case "get-code":
      chrome.tabs.sendMessage(`code ${chrome.storage.sync.get("user-token")}`)
  
    default:
      break;
  }
});