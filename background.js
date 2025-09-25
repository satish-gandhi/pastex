// Background service worker for the PasteX extension

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('PasteX extension installed');

    // Initialize storage with sample data
    chrome.storage.sync.get(['quickCopyData'], (result) => {
      if (!result.quickCopyData || result.quickCopyData.length === 0) {
        const sampleData = [
          {
            id: Date.now(),
            label: 'Email',
            value: 'your.email@example.com'
          },
          {
            id: Date.now() + 1,
            label: 'Phone',
            value: '+1 (555) 123-4567'
          }
        ];

        chrome.storage.sync.set({ quickCopyData: sampleData });
      }
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Send message to content script to show floating button
  chrome.tabs.sendMessage(tab.id, { action: 'showFloatingButton' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Could not send message to tab:', chrome.runtime.lastError.message);
    }
  });
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'copyToClipboard') {
    // This is handled by the popup script directly using navigator.clipboard
    // But we can add additional functionality here if needed
    sendResponse({ success: true });
  } else if (request.action === 'openOptionsPage') {
    // Open options page when requested from content script
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
});