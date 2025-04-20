// Create and inject styles
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = chrome.runtime.getURL('styles/overlay.css');
document.head.appendChild(style);

console.log('Content script started');

// Create overlay container
const overlay = document.createElement('div');
overlay.id = 'pugpeep-overlay';
overlay.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: white;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  z-index: 9999;
  padding: 8px 20px;
  transform: translateY(-100%);
  transition: transform 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
`;

// Create close button
const closeButton = document.createElement('button');
closeButton.textContent = '×';
closeButton.style.cssText = `
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 0 10px;
`;

// Create content container
const content = document.createElement('div');
content.id = 'pugpeep-content';
content.style.cssText = `
  display: flex;
  flex-wrap: wrap;
`;

// Assemble overlay
overlay.appendChild(content);
overlay.appendChild(closeButton);
document.body.appendChild(overlay);

// Store the JSON URL when found
let atomContentsUrl = null;

// Function to monitor network requests
function setupNetworkMonitor() {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.endsWith('/pugpig_atom_contents.json') || entry.name.endsWith('/pugpig_atom_contents-preview.json')) {
        atomContentsUrl = entry.name;
        console.log('Found atom contents JSON:', atomContentsUrl);
        // Update the overlay if it's visible
        if (overlay.style.transform === 'translateY(0)') {
          updateOverlayContent();
        }
      }
    }
  });

  observer.observe({ entryTypes: ['resource'] });
}

// Function to check if iframe is truly ready
function isIframeReady(iframe) {
  if (!iframe || !iframe.contentDocument) return false;

  try {
    const innerDoc = iframe.contentDocument;
    // Check for some known elements that should exist in the iframe
    const hasContent = innerDoc.querySelector('.content') ||
      innerDoc.querySelector('meta[name="PugpigBoltTimelineVersion"]') ||
      innerDoc.querySelector('head link[rel="stylesheet"]') ||
      innerDoc.querySelector('head script');
    return hasContent !== null;
  } catch (error) {
    return false;
  }
}

// Function to check for timeline CSS with retry
function checkTimelineCss(innerDoc, retryCount = 0) {
  const timelineCssLinks = innerDoc.querySelectorAll('head link[rel="stylesheet"]');
  for (const link of timelineCssLinks) {
    if (link.href && link.href.includes('custom-timeline.css')) {
      return {
        found: true,
        url: link.href
      };
    }
  }

  // If not found try again
  if (retryCount < 3) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(checkTimelineCss(innerDoc, retryCount + 1));
      }, 500);
    });
  }

  return {
    found: false,
    url: null
  };
}

// Function to get version data
async function getVersionData() {
  const result = {};

  // Check for Reader
  const readerMetaTag = document.querySelector('meta[name="PugpigBoltReaderVersion"]');
  if (readerMetaTag) {
    result.reader = readerMetaTag.getAttribute('content');
  }

  // Check for Timeline, and Widgets in iframe
  const iframe = document.querySelector('.content');
  if (iframe && isIframeReady(iframe)) {
    try {
      const innerDoc = iframe.contentDocument;
      const innerWindow = iframe.contentWindow;

      // Check for Timeline
      const timelineMetaTag = innerDoc.querySelector('meta[name="PugpigBoltTimelineVersion"]');
      if (timelineMetaTag) {
        result.timeline = timelineMetaTag.getAttribute('content');
      }

      // Check for Widgets
      const innerHTML = innerDoc.documentElement.innerHTML;
      const widgetsMatch = innerHTML.match(/Custom widgets added by deployment: (\d+\.\d+\.\d+)/);
      if (widgetsMatch) {
        result.widgets = widgetsMatch[1];
      }

      // Check for custom-timeline.css with retry mechanism
      const cssCheck = await checkTimelineCss(innerDoc);
      if (cssCheck.found) {
        result.timelineCss = 'Found';
        result.timelineCssUrl = cssCheck.url;
        console.log('Found custom-timeline.css:', cssCheck.url);
      } else {
        result.timelineCss = 'Not found';
        console.log('custom-timeline.css not found in iframe head after retries');
      }

      // Check for timeline grid and style version
      const scripts = innerDoc.querySelectorAll('head script[type="application/javascript"]');
      for (const script of scripts) {
        const scriptContent = script.textContent;
        if (scriptContent.includes('useTimelineGrid') && scriptContent.includes('timelineStyleVersion')) {
          const gridMatch = scriptContent.match(/window\.useTimelineGrid\s*=\s*(true|false)/);
          const versionMatch = scriptContent.match(/window\.timelineStyleVersion\s*=\s*['"]([^'"]+)['"]/);

          if (gridMatch) {
            result.timelineGrid = gridMatch[1] === 'true' ? 'Active' : 'Inactive';
          }
          if (versionMatch) {
            result.timelineStyleVersion = versionMatch[1];
          }
          break;
        }
      }

      // Set defaults if not found
      if (!result.timelineGrid) result.timelineGrid = 'Inactive';
      if (!result.timelineStyleVersion) result.timelineStyleVersion = 'Not found';

    } catch (error) {
      console.error('Error accessing iframe content:', error);
    }
  } else {
    console.log('Iframe not ready yet');
  }

  // Add atom contents status
  result.atomContents = atomContentsUrl ? 'Found' : 'Not found';
  result.atomContentsUrl = atomContentsUrl;

  return result;
}

// Function to update overlay content
async function updateOverlayContent() {
  const data = await getVersionData();

  // Only show if Bolt Reader version is found
  if (!data.reader) {
    overlay.style.transform = 'translateY(-100%)';
    return;
  }

  const iconUrl = chrome.runtime.getURL('icons/icon-128.png');

  const overlayData = `
    <img class="pugpeep-logo" src="${iconUrl}" style="height: 24px;" onerror="console.error('Failed to load icon')">
    <div class="overlay-item">
      <span class="label">Timeline:</span>
      <span class="status ${data.timeline ? 'found' : ''}">${data.timeline || 'Not found'}</span>
    </div>
    <div class="overlay-item">
      <span class="label">Reader:</span>
      <span class="status ${data.reader ? 'found' : ''}">${data.reader || 'Not found'}</span>
    </div>
    <div class="overlay-item">
      <span class="label">Widgets:</span>
      <span class="status ${data.widgets ? 'found' : ''}">${data.widgets || 'Not found'}</span>
    </div>
    <div class="overlay-item">
      <span class="label">Timeline Grid:</span>
      <span class="status ${data.timelineGrid === 'Active' ? 'found' : 'not-found'}">${data.timelineGrid || 'Inactive'}</span>
    </div>
    <div class="overlay-item">
      <span class="label">Timeline Style:</span>
      <span class="status ${data.timelineStyleVersion !== 'Not found' ? 'found' : 'not-found'}">${data.timelineStyleVersion}</span>
    </div>
    <div class="overlay-item">
      <span class="label">Timeline CSS:</span>
      <span class="status ${data.timelineCss === 'Found' ? 'found' : 'not-found'}">
        ${data.timelineCss === 'Found' ? `<a href="${data.timelineCssUrl}" target="_blank">Found</a>` : 'Not found'}
      </span>
    </div>
    <div class="overlay-item">
      <span class="label">Atom Feed:</span>
      <span class="status ${data.atomContents === 'Found' ? 'found' : 'not-found'}">
        ${data.atomContents === 'Found' ? `<a href="${data.atomContentsUrl}" target="_blank">Found</a>` : 'Not found'}
      </span>
    </div>
  `;

  content.innerHTML = overlayData;
  overlay.style.transform = 'translateY(0)';
}

// Listen for messages from the extension icon click
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleOverlay') {
    if (overlay.style.transform === 'translateY(0)') {
      overlay.style.transform = 'translateY(-100%)';
    } else {
      updateOverlayContent();
    }
    sendResponse({ success: true });
  }
  return true;
});

// Close button handler
closeButton.addEventListener('click', () => {
  overlay.style.transform = 'translateY(-100%)';
});

// Function to setup iframe listener
function setupIframeListener() {
  const iframe = document.querySelector('.content');
  if (iframe) {
    // Remove any existing listeners to prevent duplicates
    iframe.removeEventListener('load', handleIframeLoad);
    // Add new listener
    iframe.addEventListener('load', handleIframeLoad);
  }
}

// Function to handle iframe load
function handleIframeLoad() {
  console.log('Iframe load event fired');
  // Give a small delay to ensure content is fully loaded
  setTimeout(() => {
    if (isIframeReady(this)) {
      console.log('Iframe content verified ready');
      updateOverlayContent();
    } else {
      console.log('Iframe content not ready yet, will retry');
      // If not ready, try again after a short delay
      setTimeout(() => {
        if (isIframeReady(this)) {
          updateOverlayContent();
        }
      }, 500);
    }
  }, 100);
}

// Listen for DOM changes to catch iframe when it's added
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      setupIframeListener();
    }
  }
});

// Start observing the document body for changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial setup
setupNetworkMonitor();
setupIframeListener();
// Initial check with a small delay to ensure iframe is loaded
setTimeout(() => {
  updateOverlayContent();
}, 500);