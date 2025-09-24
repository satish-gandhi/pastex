document.addEventListener('DOMContentLoaded', function() {
  const dataList = document.getElementById('dataList');
  const manageBtn = document.getElementById('manageBtn');

  // Load and display saved data
  loadData();

  // Handle manage button click
  manageBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  async function loadData() {
    try {
      const result = await chrome.storage.sync.get(['quickCopyData']);
      const data = result.quickCopyData || [];
      displayData(data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }


  async function copyToClipboard(text, event) {
    try {
      await navigator.clipboard.writeText(text);

      // Show feedback
      const button = event.target;
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.classList.add('copied');

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 1000);

    } catch (error) {
      console.error('Failed to copy to clipboard:', error);

      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      const button = event.target;
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.classList.add('copied');

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 1000);
    }
  }

  function displayData(data) {
    dataList.innerHTML = '';

    if (data.length === 0) {
      dataList.innerHTML = '<p class="no-data">No data saved yet. Click "Manage Data" to add some!</p>';
      return;
    }

    data.forEach(item => {
      const dataItem = document.createElement('div');
      dataItem.className = 'data-item';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.innerHTML = `<span class="label">${escapeHtml(item.label)}</span><span class="copy-text">Copy</span>`;
      copyBtn.addEventListener('click', (e) => copyToClipboard(item.value, e));

      dataItem.appendChild(copyBtn);
      dataList.appendChild(dataItem);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});