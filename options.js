document.addEventListener('DOMContentLoaded', function() {
  const dataList = document.getElementById('dataList');
  const addDataForm = document.getElementById('addDataForm');
  const labelInput = document.getElementById('labelInput');
  const valueInput = document.getElementById('valueInput');
  const statusMessage = document.getElementById('statusMessage');

  // Load and display saved data
  loadData();

  // Handle form submission
  addDataForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const label = labelInput.value.trim();
    const value = valueInput.value.trim();

    if (label && value) {
      addData(label, value);
      labelInput.value = '';
      valueInput.value = '';
    }
  });

  async function loadData() {
    try {
      const result = await chrome.storage.sync.get(['quickCopyData']);
      const data = result.quickCopyData || [];
      displayData(data);
    } catch (error) {
      console.error('Error loading data:', error);
      showStatus('Error loading data', 'error');
    }
  }

  async function addData(label, value) {
    try {
      const result = await chrome.storage.sync.get(['quickCopyData']);
      const data = result.quickCopyData || [];

      // Check if label already exists
      const existingItem = data.find(item => item.label.toLowerCase() === label.toLowerCase());
      if (existingItem) {
        showStatus('A data item with this label already exists!', 'error');
        return;
      }

      // Add new data item
      data.push({
        id: Date.now(),
        label: label,
        value: value
      });

      await chrome.storage.sync.set({ quickCopyData: data });
      displayData(data);
      showStatus('Data added successfully!', 'success');
    } catch (error) {
      console.error('Error adding data:', error);
      showStatus('Error adding data', 'error');
    }
  }

  async function deleteData(id) {
    if (!confirm('Are you sure you want to delete this data item?')) {
      return;
    }

    try {
      const result = await chrome.storage.sync.get(['quickCopyData']);
      const data = result.quickCopyData || [];

      const filteredData = data.filter(item => item.id !== id);

      await chrome.storage.sync.set({ quickCopyData: filteredData });
      displayData(filteredData);
      showStatus('Data deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting data:', error);
      showStatus('Error deleting data', 'error');
    }
  }

  async function editData(id, newLabel, newValue) {
    try {
      const result = await chrome.storage.sync.get(['quickCopyData']);
      const data = result.quickCopyData || [];

      // Check if new label conflicts with existing items (excluding current item)
      const existingItem = data.find(item => item.id !== id && item.label.toLowerCase() === newLabel.toLowerCase());
      if (existingItem) {
        showStatus('A data item with this label already exists!', 'error');
        return;
      }

      const itemIndex = data.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        data[itemIndex].label = newLabel;
        data[itemIndex].value = newValue;

        await chrome.storage.sync.set({ quickCopyData: data });
        displayData(data);
        showStatus('Data updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error updating data:', error);
      showStatus('Error updating data', 'error');
    }
  }

  function displayData(data) {
    dataList.innerHTML = '';

    if (data.length === 0) {
      dataList.innerHTML = '<p class="no-data">No data saved yet. Add some using the form above!</p>';
      return;
    }

    data.forEach(item => {
      const dataItem = document.createElement('div');
      dataItem.className = 'data-item';

      dataItem.innerHTML = `
        <div class="data-content">
          <div class="data-label" data-id="${item.id}">${escapeHtml(item.label)}</div>
          <div class="data-value" data-id="${item.id}">${escapeHtml(item.value)}</div>
        </div>
        <div class="data-actions">
          <button class="edit-btn" data-id="${item.id}">Edit</button>
          <button class="delete-btn" data-id="${item.id}">Delete</button>
        </div>
      `;

      // Add event listeners
      const editBtn = dataItem.querySelector('.edit-btn');
      const deleteBtn = dataItem.querySelector('.delete-btn');

      editBtn.addEventListener('click', () => startEdit(item.id, item.label, item.value));
      deleteBtn.addEventListener('click', () => deleteData(item.id));

      dataList.appendChild(dataItem);
    });
  }

  function startEdit(id, currentLabel, currentValue) {
    const dataItem = document.querySelector(`[data-id="${id}"]`).closest('.data-item');
    const dataContent = dataItem.querySelector('.data-content');
    const dataActions = dataItem.querySelector('.data-actions');

    // Replace content with edit form
    dataContent.innerHTML = `
      <div class="edit-form">
        <input type="text" class="edit-label" value="${escapeHtml(currentLabel)}" required>
        <textarea class="edit-value" required>${escapeHtml(currentValue)}</textarea>
      </div>
    `;

    // Replace actions with save/cancel buttons
    dataActions.innerHTML = `
      <button class="save-btn">Save</button>
      <button class="cancel-btn">Cancel</button>
    `;

    const saveBtn = dataActions.querySelector('.save-btn');
    const cancelBtn = dataActions.querySelector('.cancel-btn');
    const editLabel = dataContent.querySelector('.edit-label');
    const editValue = dataContent.querySelector('.edit-value');

    saveBtn.addEventListener('click', () => {
      const newLabel = editLabel.value.trim();
      const newValue = editValue.value.trim();

      if (newLabel && newValue) {
        editData(id, newLabel, newValue);
      }
    });

    cancelBtn.addEventListener('click', () => {
      loadData(); // Reload to cancel edit
    });

    // Focus on label input
    editLabel.focus();
  }

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';

    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});