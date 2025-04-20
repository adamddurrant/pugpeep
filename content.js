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
  if (iframe && isIframeReady(iframe)) {
    try {
      const innerDoc = iframe.contentDocument;
      const innerWindow = iframe.contentWindow;
      
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

      // Check for custom-timeline.css with more reliable lookup
      const timelineCssLinks = innerDoc.querySelectorAll('head link[rel="stylesheet"]');
      console.log('Found stylesheet links:', timelineCssLinks.length);
      for (const link of timelineCssLinks) {
        console.log('Checking stylesheet:', link.href);
        if (link.href && link.href.includes('custom-timeline.css')) {
          result.timelineCss = 'Found';
          result.timelineCssUrl = link.href;
          console.log('Found custom-timeline.css:', link.href);
          break;
        }
      }
      if (!result.timelineCss) {
        result.timelineCss = 'Not found';
        console.log('custom-timeline.css not found in iframe head');
      }

      // Check for timeline grid and style version
      try {
        // First try to access the variables directly
        if (typeof innerWindow.useTimelineGrid !== 'undefined' && typeof innerWindow.timelineStyleVersion !== 'undefined') {
          result.timelineGrid = innerWindow.useTimelineGrid === true ? 'Active' : 'Inactive';
          result.timelineStyleVersion = innerWindow.timelineStyleVersion;
        } else {
          // If direct access fails, try to find the script and parse it
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
        }
        
        // Set defaults if not found
        if (!result.timelineGrid) result.timelineGrid = 'Inactive';
        if (!result.timelineStyleVersion) result.timelineStyleVersion = 'Not found';
        
        console.log('Timeline Grid:', result.timelineGrid);
        console.log('Timeline Style Version:', result.timelineStyleVersion);
      } catch (error) {
        console.log('Could not access timeline variables:', error);
        result.timelineGrid = 'Inactive';
        result.timelineStyleVersion = 'Not found';
      }
    } catch (error) {
      console.error('Error accessing iframe content:', error);
    }
  } else {
    console.log('Iframe not ready yet');
  }

  return result;
}

// Function to update overlay content
function updateOverlayContent() {
  const data = getVersionData();
  
  // Only show if Bolt Reader version is found
  if (!data.reader) {
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
      <span class="label">Timeline CSS:</span>
      <span class="status ${data.timelineCss === 'Found' ? 'found' : 'not-found'}">
        ${data.timelineCss === 'Found' ? `<a href="${data.timelineCssUrl}" target="_blank">Found</a>` : 'Not found'}
      </span>
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
      <span class="label">Search:</span>
      <span class="status ${data.search ? 'found' : ''}">${data.search || 'Not found'}</span>
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
    console.log('Added iframe load listener');
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
setupIframeListener();
// Initial check with a small delay to ensure iframe is loaded
setTimeout(() => {
  updateOverlayContent();
}, 500);