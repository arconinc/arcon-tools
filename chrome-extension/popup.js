const statusEl = document.getElementById('status')
const recordEl = document.getElementById('record')
const titleEl = document.getElementById('record-title')
const metaEl = document.getElementById('record-meta')
const fieldListEl = document.getElementById('field-list')
const fillButton = document.getElementById('fill')
const clearButton = document.getElementById('clear')

let currentPayload = null

function valueText(value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function render(payload) {
  currentPayload = payload ?? null

  if (!payload) {
    statusEl.textContent = 'Waiting for a The Arc record.'
    recordEl.classList.add('hidden')
    fillButton.disabled = true
    fieldListEl.replaceChildren()
    return
  }

  const date = new Date(payload.exportedAt)
  statusEl.textContent = 'Ready to fill an Aturian page.'
  titleEl.textContent = payload.recordName
  metaEl.textContent = `${payload.entityType} exported ${date.toLocaleString()}`
  fillButton.disabled = false

  const rows = Object.values(payload.fields)
    .filter((field) => field.value !== null && field.value !== undefined && field.value !== '')
    .map((field) => {
      const row = document.createElement('div')
      row.className = 'field-row'

      const label = document.createElement('dt')
      label.textContent = field.label

      const value = document.createElement('dd')
      value.textContent = valueText(field.value)

      row.append(label, value)
      return row
    })

  fieldListEl.replaceChildren(...rows)
  recordEl.classList.remove('hidden')
}

async function loadPayload() {
  const data = await chrome.storage.local.get('aturianTransferPayload')
  render(data.aturianTransferPayload)
}

fillButton.addEventListener('click', async () => {
  if (!currentPayload) return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['scripts/aturian-fill.js'],
  })

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'ATURIAN_FILL_FORM',
    payload: currentPayload,
  }).catch((error) => ({ ok: false, error: error.message }))

  if (response?.ok) {
    statusEl.textContent = `Filled ${response.filledCount} field${response.filledCount === 1 ? '' : 's'}. Review before saving.`
  } else {
    statusEl.textContent = response?.error ?? 'Could not fill this page.'
  }
})

clearButton.addEventListener('click', async () => {
  await chrome.storage.local.remove('aturianTransferPayload')
  render(null)
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.aturianTransferPayload) return
  render(changes.aturianTransferPayload.newValue)
})

loadPayload()
