window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return
  if (event.data?.source !== 'the-arc') return
  if (event.data?.type !== 'ATURIAN_TRANSFER_PAYLOAD') return

  chrome.storage.local.set({
    aturianTransferPayload: event.data.payload,
  })
})
