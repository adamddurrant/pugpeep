// Run main get and set function
run();

// Refresh button handler
var refresh = document.getElementById('refresh');
refresh.addEventListener('click', function () {

  var refreshIcon = document.querySelector('.refresh-icon');
  refreshIcon.classList.add('animate');

  setTimeout(() => {
    refreshIcon.classList.remove('animate');
  }, 1000);

  run();

})

function run() {

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

    const tabId = tabs[0].id;

    // Run getVersionData on current tab, define variables, set data and handle errors
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId, allFrames: true },
        function: getVersionData,
      },
      (result) => {

        let timeline = document.getElementById('timelineVersion');
        let reader = document.getElementById('readerVersion');
        let widgets = document.getElementById('widgetsVersion');
        let search = document.getElementById('searchVersion');

        let timelineStatus = document.getElementById('timelineStatus');
        let readerStatus = document.getElementById('readerStatus');
        let widgetsStatus = document.getElementById('widgetsStatus');
        let searchStatus = document.getElementById('searchStatus');

        // Set current URL
        var currentURL = document.getElementById('current-url');
        currentURL.innerText = tabs[0].url;

        // Set view-source: button
        var viewSource = document.getElementById('view-source');
        viewSource.addEventListener('click', function () {

          chrome.tabs.create({
            active: true,
            url: "view-source:" + tabs[0].url,
          });

        })

        if (chrome.runtime.lastError) {
          timeline.textContent = 'Error: Cannot access this page';
          reader.textContent = 'Error: Cannot access this page';
          widgets.textContent = 'Error: Cannot access this page';
          return;
        }

        const data = result[0].result;

        if (data.reader) {
          reader.textContent = data.reader;
          readerStatus.classList.add("found");
          readerStatus.innerText = "present";
        } else {
          reader.textContent = 'Version: Not found';
        }

        if (data.timeline) {
          timeline.textContent = data.timeline;
          timelineStatus.classList.add("found");
          timelineStatus.innerText = "present";
        } else {
          timeline.textContent = 'Version: Not found';
        }

        if (data.search) {
          search.textContent = data.search;
          searchStatus.classList.add("found");
          searchStatus.innerText = "present";
        } else {
          search.textContent = 'Version: Not found';
        }

        if (data.widgets) {
          widgets.textContent = data.widgets;
          widgetsStatus.classList.add("found");
          widgetsStatus.innerText = "present";
        } else {
          widgets.textContent = 'Version: Not found';
        }

      }
    );
  });

  // Get version data and package into object
  function getVersionData() {

    const iframe = document.querySelector('.content');
    const readerMetaTag = document.querySelector('meta[name="PugpigBoltReaderVersion"]');

    const result = {};

    if (readerMetaTag) {
      const readerContent = readerMetaTag.getAttribute('content');
      if (readerContent) {
        result.reader = 'Version: ' + readerContent;
      }
    }

    if (iframe) {
      const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
      const timelineMetaTag = innerDoc.querySelector('meta[name="PugpigBoltTimelineVersion"]');
      const searchMetaTag = innerDoc.querySelector('meta[name="PugpigBoltSearchVersion"]');
      const innerHTML = innerDoc.documentElement.innerHTML;
      const regex = /Custom widgets added by deployment: (\d+\.\d+\.\d+)/;
      const match = innerHTML.match(regex);

      if (timelineMetaTag) {
        const timelineContent = timelineMetaTag.getAttribute('content');
        if (timelineContent) {
          result.timeline = 'Version: ' + timelineContent;
        }
      }

      if (searchMetaTag) {
        const searchContent = searchMetaTag.getAttribute('content');
        if (searchContent) {
          result.search = 'Version: ' + searchContent;
        }
      }

      if (match) {
        const versionNumber = match[1];
        result.widgets = 'Version: ' + versionNumber;
      }

    }
    return result;
  }

  // Handle accordion
  const closedElems = document.querySelectorAll(".closed");

  closedElems.forEach((closed) => {

    closed.onclick = function () {

      let container = this.parentElement;
      container.classList.toggle("expanded");
      let chevron = container.querySelector('.chevron');
      chevron.classList.toggle("toggle");

    };

  });

}