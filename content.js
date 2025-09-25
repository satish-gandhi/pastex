// PasteX Extension - Content Script

(function() {
  'use strict';

  let floatingBtn = null;
  let floatingMenu = null;
  let isMenuOpen = false;
  let extensionContext = true;

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      return chrome && chrome.runtime && chrome.runtime.id && extensionContext;
    } catch (error) {
      extensionContext = false;
      return false;
    }
  }

  // Initialize the floating button and menu
  async function init() {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalid - not initializing PasteX');
      return;
    }

    // Check if button is hidden
    try {
      const result = await chrome.storage.local.get(['quickCopyButtonHidden']);
      if (result.quickCopyButtonHidden) {
        return; // Don't create button if it was hidden
      }
    } catch (error) {
      console.error('Error checking button hidden state:', error);
    }

    createFloatingButton();
    createFloatingMenu();
    await loadMenuState();
    loadDataAndUpdateMenu();
  }

  function createFloatingButton() {
    // Avoid creating duplicate buttons
    if (document.getElementById('quick-copy-floating-btn')) return;

    floatingBtn = document.createElement('button');
    floatingBtn.id = 'quick-copy-floating-btn';
    floatingBtn.innerHTML = '<img src="' + chrome.runtime.getURL('icon.png') + '" alt="PasteX" style="width: 24px; height: 24px;"><span class="close-x">×</span>';
    floatingBtn.title = 'PasteX';
    floatingBtn.addEventListener('click', handleFloatingButtonClick);

    document.body.appendChild(floatingBtn);
  }

  function createFloatingMenu() {
    // Avoid creating duplicate menus
    if (document.getElementById('quick-copy-floating-menu')) return;

    floatingMenu = document.createElement('div');
    floatingMenu.id = 'quick-copy-floating-menu';

    floatingMenu.innerHTML = `
      <div class="quick-copy-menu-header">PasteX</div>
      <div class="quick-copy-menu-content" id="quick-copy-menu-content">
        <div class="quick-copy-no-data">Loading...</div>
      </div>
      <div class="quick-copy-menu-footer">
        <button class="quick-copy-manage-btn" id="quick-copy-manage-btn">Manage Data</button>
      </div>
    `;

    document.body.appendChild(floatingMenu);

    // Add event listeners
    document.getElementById('quick-copy-manage-btn').addEventListener('click', openOptionsPage);

    // Note: Removed click outside to close functionality to maintain persistence
    // Menu should only close when user explicitly clicks the floating button
  }

  function toggleMenu() {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    if (!floatingMenu) return;

    floatingMenu.classList.add('show');
    isMenuOpen = true;
    saveMenuState(true);
    loadDataAndUpdateMenu(); // Refresh data when opening
  }

  function closeMenu() {
    if (!floatingMenu) return;

    floatingMenu.classList.remove('show');
    isMenuOpen = false;
    saveMenuState(false);
  }

  async function saveMenuState(isOpen) {
    if (!isExtensionContextValid()) {
      return; // Silent fail if extension context is invalid
    }

    try {
      await chrome.storage.local.set({ quickCopyMenuOpen: isOpen });
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        extensionContext = false;
        // Don't show error to user, just fail silently
      } else {
        console.error('Error saving menu state:', error);
      }
    }
  }

  async function loadMenuState() {
    if (!isExtensionContextValid()) {
      isMenuOpen = false;
      return;
    }

    try {
      const result = await chrome.storage.local.get(['quickCopyMenuOpen']);
      const shouldBeOpen = result.quickCopyMenuOpen || false;

      if (shouldBeOpen) {
        // Set the state without triggering save
        isMenuOpen = true;
        if (floatingMenu) {
          floatingMenu.classList.add('show');
        }
      } else {
        isMenuOpen = false;
        if (floatingMenu) {
          floatingMenu.classList.remove('show');
        }
      }
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        extensionContext = false;
      } else {
        console.error('Error loading menu state:', error);
      }
      isMenuOpen = false;
    }
  }

  async function loadDataAndUpdateMenu() {
    if (!isExtensionContextValid()) {
      updateMenuContent([]);
      return;
    }

    try {
      const result = await chrome.storage.sync.get(['quickCopyData']);
      const data = result.quickCopyData || [];
      updateMenuContent(data);
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        extensionContext = false;
        updateMenuContent([]);
      } else {
        console.error('Error loading data:', error);
        updateMenuContent([]);
      }
    }
  }

  function updateMenuContent(data) {
    const menuContent = document.getElementById('quick-copy-menu-content');
    if (!menuContent) return;

    if (data.length === 0) {
      menuContent.innerHTML = '<div class="quick-copy-no-data">No data saved yet.<br>Click "Manage Data" to add some!</div>';
      return;
    }

    menuContent.innerHTML = '';

    data.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'quick-copy-menu-item';

      menuItem.innerHTML = `
        <div class="quick-copy-menu-item-label">${escapeHtml(item.label)}</div>
        <button class="quick-copy-menu-item-copy" data-value="${escapeHtml(item.value)}">Copy</button>
      `;

      const copyBtn = menuItem.querySelector('.quick-copy-menu-item-copy');
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.value, copyBtn);
      });

      menuContent.appendChild(menuItem);
    });
  }

  async function copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback(button);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);

      // Fallback for older browsers or when clipboard API fails
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyFeedback(button);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        button.textContent = 'Failed';
        button.style.background = '#ea4335';
        setTimeout(() => {
          button.textContent = 'Copy';
          button.style.background = '#1a73e8';
        }, 1000);
      }
    }
  }

  function showCopyFeedback(button) {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('copied');

    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 1000);
  }

  function handleFloatingButtonClick(event) {
    // Check if clicked on the X
    if (event.target.classList.contains('close-x')) {
      hideFloatingButton();
      return;
    }
    // Otherwise toggle menu
    toggleMenu();
  }

  function hideFloatingButton() {
    const button = document.getElementById('quick-copy-floating-btn');
    if (button) {
      button.style.display = 'none';
      // Save the hidden state
      try {
        chrome.storage.local.set({ quickCopyButtonHidden: true });
      } catch (error) {
        console.error('Error saving button hidden state:', error);
      }
    }
    // Also hide the menu if it's open
    closeMenu();
  }

  function openOptionsPage() {
    if (!isExtensionContextValid()) {
      alert('Extension context invalid. Please reload the page and try again.');
      return;
    }

    try {
      chrome.runtime.sendMessage({ action: 'openOptionsPage' });
      // Don't auto-close menu since we want persistence
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        extensionContext = false;
        alert('Extension context invalidated. Please reload the page and try again.');
      } else {
        console.error('Error opening options page:', error);
        alert('Cannot open options page. Please try again.');
      }
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show floating button function
  function showFloatingButton() {
    // Reset the hidden state
    try {
      chrome.storage.local.set({ quickCopyButtonHidden: false });
    } catch (error) {
      console.error('Error resetting button hidden state:', error);
    }

    // Check if button already exists
    if (document.getElementById('quick-copy-floating-btn')) {
      const button = document.getElementById('quick-copy-floating-btn');
      button.style.display = 'block';
      return;
    }

    // Create the button if it doesn't exist
    createFloatingButton();
    createFloatingMenu();
    loadMenuState();
    loadDataAndUpdateMenu();
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showFloatingButton') {
      showFloatingButton();
      sendResponse({ success: true });
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Listen for storage changes to update menu in real-time
  try {
    if (isExtensionContextValid() && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.quickCopyData) {
          if (isMenuOpen && isExtensionContextValid()) {
            loadDataAndUpdateMenu();
          }
        }
      });
    }
  } catch (error) {
    console.warn('Cannot set up storage change listener:', error);
  }

})();