(function installAturianFill() {
  if (window.__arconAturianAssistInstalled) return
  window.__arconAturianAssistInstalled = true

  // customer map: field key → array of Aturian input[name] values (matched case-insensitively, ALL matches filled)
  const CUSTOMER_NAME_MAP = {
    company_name:       ['name', 'Mcompanyname', 'Scompanyname', 'bcompanyname'],
    phone:              ['btelephone', 'Gtelephone'],
    website:            ['Gwebaddress'],
    address1:           ['MstreetLine1', 'SstreetLine1', 'bstreetLine1'],
    address2:           ['MstreetLine2', 'SstreetLine2', 'bstreetLine2'],
    city:               ['Mcity', 'Scity', 'bcity'],
    state:              ['MstateId', 'SstateId', 'bstateId'],
    zip:                ['Mpostalcode', 'Spostalcode', 'bpostalcode'],
    orderer_full_name:  ['Mattention', 'Sattention'],
    orderer_first_name: ['Gfname'],
    orderer_last_name:  ['Glastname'],
    orderer_email:      ['toUserId'],
    ap_first_name:      ['bfname'],
    ap_last_name:       ['blastname'],
    ap_email:           ['toUserId'],
  }

  const FIELD_MAPS = {
    customer: null, // handled via CUSTOMER_NAME_MAP
    supplier: {
      name: ['input[name="SupplierName"]', 'input[name="VendorName"]', 'input[name="Name"]', 'input[aria-label*="supplier" i]', 'input[aria-label*="vendor" i]'],
      phone: ['input[name="Phone"]', 'input[type="tel"]', 'input[aria-label*="phone" i]'],
      website: ['input[name="Website"]', 'input[type="url"]'],
      product_line: ['select[name="ProductLine"]', 'input[name="ProductLine"]'],
      specialty: ['select[name="Specialty"]', 'input[name="Specialty"]'],
      arcon_account_number: ['input[name="AccountNumber"]', 'input[name="ArconAccountNumber"]'],
      customer_service_email: ['input[name="CustomerServiceEmail"]'],
      orders_email: ['input[name="OrdersEmail"]'],
      billing_address1: ['input[name="BillingAddress1"]', 'input[aria-label*="billing address" i]'],
      billing_address2: ['input[name="BillingAddress2"]'],
      billing_city: ['input[name="BillingCity"]'],
      billing_state: ['input[name="BillingState"]', 'select[name="BillingState"]'],
      billing_zip: ['input[name="BillingZip"]', 'input[name="BillingPostalCode"]'],
      billing_country: ['input[name="BillingCountry"]', 'select[name="BillingCountry"]'],
      shipping_address1: ['input[name="ShippingAddress1"]', 'input[aria-label*="shipping address" i]'],
      shipping_address2: ['input[name="ShippingAddress2"]'],
      shipping_city: ['input[name="ShippingCity"]'],
      shipping_state: ['input[name="ShippingState"]', 'select[name="ShippingState"]'],
      shipping_zip: ['input[name="ShippingZip"]', 'input[name="ShippingPostalCode"]'],
      shipping_country: ['input[name="ShippingCountry"]', 'select[name="ShippingCountry"]'],
      ap_name: ['input[name="APContactName"]', 'input[name="AccountsPayableName"]'],
      ap_email: ['input[name="APEmail"]', 'input[name="AccountsPayableEmail"]'],
    },
  }

  function isFillable(element) {
    return element && !element.disabled
  }

  function normalizeLabel(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  function firstFillable(root) {
    return root.querySelector('input:not([type="hidden"]), select, textarea, [contenteditable="true"]')
  }

  function findFieldByLabel(labelText) {
    const target = normalizeLabel(labelText)
    if (!target) return null

    const direct = Array.from(document.querySelectorAll('input, select, textarea')).find((element) => {
      return isFillable(element) && normalizeLabel(element.getAttribute('aria-label')).includes(target)
    })
    if (direct) return direct

    for (const label of document.querySelectorAll('label')) {
      const text = normalizeLabel(label.textContent)
      if (!text || (!text.includes(target) && !target.includes(text))) continue

      const forId = label.getAttribute('for')
      if (forId) {
        const byId = document.getElementById(forId)
        if (isFillable(byId)) return byId
      }

      const nested = firstFillable(label)
      if (isFillable(nested)) return nested

      const container = label.closest('div, li, tr, section, fieldset')
      const nearby = container ? firstFillable(container) : null
      if (isFillable(nearby)) return nearby
    }

    return null
  }

  function findAllByNames(fieldNames) {
    const lower = fieldNames.map((n) => n.toLowerCase())
    // ponytail: skip disabled check — ExtJS marks inactive-tab inputs disabled; JS value assignment still works
    return Array.from(document.querySelectorAll('input, select, textarea')).filter(
      (el) => el && lower.includes((el.getAttribute('name') ?? '').toLowerCase())
    )
  }

  function findField(selectors, labelText) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
        console.log('element:', selector, element);
      if (isFillable(element)) return element
    }
    return findFieldByLabel(labelText)
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element)
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
    if (descriptor?.set) {
      descriptor.set.call(element, value)
    } else {
      element.value = value
    }
  }

  function selectOption(select, rawValue) {
    const value = String(rawValue).trim().toLowerCase()
    const option = Array.from(select.options).find((item) => {
      const optionText = item.textContent.trim().toLowerCase()
      return item.value.toLowerCase() === value || optionText === value || optionText.includes(value)
    })

    if (!option) return false
    select.value = option.value
    return true
  }

  function fillField(element, rawValue) {
    const value = rawValue === true ? 'Yes' : rawValue === false ? 'No' : String(rawValue ?? '')

    if (element instanceof HTMLSelectElement) {
      if (!selectOption(element, value)) return false
    } else if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.checked = rawValue === true || value.toLowerCase() === 'yes'
    } else if (element instanceof HTMLInputElement && element.type === 'radio') {
      element.checked = true
    } else if (element.isContentEditable) {
      element.textContent = value
    } else {
      setNativeValue(element, value)
    }

    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    element.style.outline = '2px solid #7c3aed'
    element.style.outlineOffset = '2px'
    return true
  }

  function showSummary(filled, missing) {
    document.getElementById('arcon-aturian-assist-summary')?.remove()

    const summary = document.createElement('div')
    summary.id = 'arcon-aturian-assist-summary'
    summary.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'max-width:360px',
      'padding:12px 14px',
      'border:1px solid #ddd6fe',
      'border-radius:8px',
      'background:#fff',
      'box-shadow:0 14px 38px rgba(15,23,42,.18)',
      'color:#0f172a',
      'font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';')

    summary.textContent = `Aturian Assist filled ${filled.length} field${filled.length === 1 ? '' : 's'}. Review every value before saving.`

    if (missing.length > 0) {
      const missingText = document.createElement('div')
      missingText.style.cssText = 'margin-top:6px;color:#64748b;font-size:12px'
      missingText.textContent = `No matching field found for: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '...' : ''}`
      summary.appendChild(missingText)
    }

    document.body.appendChild(summary)
    window.setTimeout(() => summary.remove(), 9000)
  }

  async function renderAllTabs() {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
    if (tabs.length === 0) return
    const activeTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true' || t.classList.contains('x-tab-active'))
    for (const tab of tabs) {
      tab.click()
      await new Promise((r) => setTimeout(r, 80))
    }
    if (activeTab) {
      activeTab.click()
      await new Promise((r) => setTimeout(r, 80))
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'ATURIAN_FILL_FORM') return

    const payload = message.payload
    const filled = []
    const missing = []

    if (payload.entityType === 'customer') {
      renderAllTabs().then(() => {
        Object.entries(payload.fields).forEach(([key, field]) => {
          const nameList = CUSTOMER_NAME_MAP[key]
          if (!nameList) return
          if (field.value === null || field.value === undefined || field.value === '') return

          const elements = findAllByNames(nameList)
          if (elements.length === 0) {
            missing.push(field.label)
            return
          }
          elements.forEach((el) => { if (fillField(el, field.value)) filled.push(field.label) })
        })
        showSummary(filled, missing)
        sendResponse({ ok: true, filledCount: filled.length, missing })
      })
      return true // async response
    } else {
      const fieldMap = FIELD_MAPS[payload.entityType]
        console.log('fieldMap:', fieldMap);
      Object.entries(payload.fields).forEach(([key, field]) => {
        if (!fieldMap?.[key]) return
        if (field.value === null || field.value === undefined || field.value === '') return

        const element = findField(fieldMap[key], field.label)
          console.log('element:', element);
        if (!element) {
          missing.push(field.label)
          return
        }
        if (fillField(element, field.value)) filled.push(field.label)
      })
    }

    showSummary(filled, missing)
    sendResponse({ ok: true, filledCount: filled.length, missing })
  })
})()
