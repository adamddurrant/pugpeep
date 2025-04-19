chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' });
});

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.url.endsWith('/pugpig_atom_contents.json')) {
      // Send the URL to the content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'JSON_URL',
          url: details.url
        });
      });
    }
  },
  {urls: ["<all_urls>"]}
); 