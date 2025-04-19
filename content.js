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
  gap: 20px;
  flex-wrap: wrap;
`;

// Assemble overlay
overlay.appendChild(content);
overlay.appendChild(closeButton);
document.body.appendChild(overlay);

// Store the JSON URL
let jsonUrl = null;

// Function to get version data
function getVersionData() {
  const result = {};

  // Check for Reader
  const readerMetaTag = document.querySelector('meta[name="PugpigBoltReaderVersion"]');
  if (readerMetaTag) {
    result.reader = readerMetaTag.getAttribute('content');
  }

  // Check for Timeline, Search, and Widgets in iframe
  const iframe = document.querySelector('.content');
  if (iframe && iframe.contentDocument) {
    try {
      const innerDoc = iframe.contentDocument;

      // Check for Timeline
      const timelineMetaTag = innerDoc.querySelector('meta[name="PugpigBoltTimelineVersion"]');
      if (timelineMetaTag) {
        result.timeline = timelineMetaTag.getAttribute('content');
      }

      // Check for Search
      const searchMetaTag = innerDoc.querySelector('meta[name="PugpigBoltSearchVersion"]');
      if (searchMetaTag) {
        result.search = searchMetaTag.getAttribute('content');
      }

      // Check for Widgets
      const innerHTML = innerDoc.documentElement.innerHTML;
      const widgetsMatch = innerHTML.match(/Custom widgets added by deployment: (\d+\.\d+\.\d+)/);
      if (widgetsMatch) {
        result.widgets = widgetsMatch[1];
      }
    } catch (error) {
      console.error('Error accessing iframe content:', error);
    }
  }

  return result;
}

// Function to update overlay content
function updateOverlayContent() {
  const data = getVersionData();

  // Check if any items are present
  const hasAnyItems = data.timeline || data.reader || data.widgets || data.search || jsonUrl;

  if (!hasAnyItems) {
    overlay.style.transform = 'translateY(-100%)';
    return;
  }

  const overlayData = `
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
      <span class="label">Search:</span>
      <span class="status ${data.search ? 'found' : ''}">${data.search || 'Not found'}</span>
    </div>
    ${jsonUrl ? `
    <div class="overlay-item">
      <a href="${jsonUrl}" target="_blank">Feed JSON</a>
    </div>
    ` : ''}
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
    iframe.removeEventListener('load', updateOverlayContent);
    // Add new listener
    iframe.addEventListener('load', updateOverlayContent);
  }
}

// Listen for network requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JSON_URL') {
    jsonUrl = message.url;
    updateOverlayContent();
  }
});

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
setupIframeListener();
updateOverlayContent();