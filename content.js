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

    // Add drag functionality
    makeDraggable(floatingBtn);

    // Load saved position
    loadButtonPosition();

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
      <button class="quick-copy-manage-btn" id="quick-copy-manage-btn">Manage Data</button>
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
    if (!floatingMenu || !floatingBtn) return;

    // Position menu relative to button's current position
    const buttonRect = floatingBtn.getBoundingClientRect();
    const menuMaxHeight = 350; // max-height from CSS (including header, content, and manage button)

    // Position menu above the button with adequate spacing
    floatingMenu.style.left = buttonRect.left + 'px';
    floatingMenu.style.bottom = (window.innerHeight - buttonRect.top + 15) + 'px';

    // Show menu to get accurate measurements
    floatingMenu.classList.add('show');

    // Check if menu would go off screen (above viewport or bottom cut off)
    const menuRect = floatingMenu.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // If menu goes above screen or is cut off at bottom, reposition
    if (menuRect.top < 10 || menuRect.bottom > viewportHeight - 10) {
      // Calculate better position - try to center vertically if possible
      const availableSpace = buttonRect.top - 20; // Space above button minus margin

      if (availableSpace >= menuMaxHeight) {
        // Enough space above, position above button
        floatingMenu.style.bottom = (window.innerHeight - buttonRect.top + 15) + 'px';
      } else {
        // Not enough space above, position to fit in viewport
        const optimalBottom = Math.max(10, Math.min(
          window.innerHeight - menuMaxHeight - 10,
          window.innerHeight - buttonRect.bottom - 15
        ));
        floatingMenu.style.bottom = (window.innerHeight - viewportHeight + optimalBottom) + 'px';
      }
    }

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
    // Don't handle click if we actually moved during drag
    if (hasActuallyMoved) {
      hasActuallyMoved = false;
      return;
    }

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

  let isDragging = false;
  let hasActuallyMoved = false;

  function makeDraggable(element) {
    let startY = 0;
    let startTop = 0;

    element.addEventListener('mousedown', startDrag);
    element.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
      isDragging = true;
      hasActuallyMoved = false;

      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      startY = clientY;
      startTop = parseInt(window.getComputedStyle(element).bottom, 10);

      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag, { passive: false });
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);

      e.preventDefault();
    }

    function drag(e) {
      if (!isDragging) return;

      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      const deltaY = startY - clientY;

      // Mark as actually moved if there's significant movement
      if (Math.abs(deltaY) > 5) {
        hasActuallyMoved = true;
      }

      let newBottom = startTop + deltaY;

      // Restrict to left side and bottom half of screen only
      const buttonHeight = 60;
      const screenHeight = window.innerHeight;
      const minBottom = 0; // Bottom of screen
      const maxBottom = screenHeight / 2 - buttonHeight; // Mid-screen minus button height

      newBottom = Math.max(minBottom, Math.min(newBottom, maxBottom));

      element.style.bottom = newBottom + 'px';
      element.style.left = '0px'; // Keep on left side

      e.preventDefault();
    }

    function stopDrag() {
      if (isDragging) {
        // Save position if actually moved
        if (hasActuallyMoved) {
          saveButtonPosition();
        }

        // Reset states
        isDragging = false;
        hasActuallyMoved = false;
      }

      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
    }
  }

  async function saveButtonPosition() {
    if (!floatingBtn) return;

    const bottom = parseInt(floatingBtn.style.bottom || '0', 10);

    try {
      await chrome.storage.local.set({ quickCopyButtonBottom: bottom });
    } catch (error) {
      console.error('Error saving button position:', error);
    }
  }

  async function loadButtonPosition() {
    if (!floatingBtn) return;

    try {
      const result = await chrome.storage.local.get(['quickCopyButtonBottom']);
      const bottom = result.quickCopyButtonBottom || 0;
      floatingBtn.style.bottom = bottom + 'px';
      floatingBtn.style.left = '0px';
    } catch (error) {
      console.error('Error loading button position:', error);
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