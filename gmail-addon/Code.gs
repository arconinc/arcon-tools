/**
 * Code.gs — Arc Gmail Add-On
 *
 * Entry points:
 *   buildAddOn(e)      — contextual trigger: called when a Gmail message is open
 *   buildHomePage(e)   — homepage trigger: called when no message is open
 *
 * Action handlers (registered as callback functions):
 *   showCreateTaskForm(e)  — renders the task creation form
 *   handleCreateTask(e)    — submits the form to create a CRM task
 *   handleBack(e)          — returns to the home card
 *
 * To add a new Gmail action in the future:
 *   1. Add a button to buildHomeCard()
 *   2. Write a new handler function
 *   3. Optionally add a new API route under /api/addon/ in the Arc app
 */


// ─── Entry Points ────────────────────────────────────────────────────────────

/**
 * Called when the user opens the add-on while viewing a Gmail message.
 */
function buildAddOn(e) {
  var accessToken = e.messageMetadata ? e.messageMetadata.accessToken : null;
  var messageId   = e.messageMetadata ? e.messageMetadata.messageId   : null;

  var subject     = '';
  var senderName  = '';
  var senderEmail = '';
  var bodySnippet = '';
  var threadUrl   = '';

  if (accessToken && messageId) {
    GmailApp.setCurrentMessageAccessToken(accessToken);
    try {
      var message = GmailApp.getMessageById(messageId);
      subject     = message.getSubject()  || '';
      bodySnippet = message.getPlainBody().substring(0, 300).trim();
      var rawFrom = message.getFrom(); // "Name <email>" or just "email"
      var match   = rawFrom.match(/^(.*?)\s*<(.+?)>\s*$/);
      if (match) {
        senderName  = match[1].trim().replace(/^"|"$/g, '');
        senderEmail = match[2].trim();
      } else {
        senderEmail = rawFrom.trim();
      }
      threadUrl = 'https://mail.google.com/mail/u/0/#inbox/' + message.getThread().getId();
    } catch (err) {
      // Graceful fallback if message read fails
    }
  }

  return [buildHomeCard(subject, senderName, senderEmail, bodySnippet, threadUrl)];
}

/**
 * Called when the add-on is opened from the Gmail sidebar without a message selected.
 */
function buildHomePage(e) {
  return buildHomeCard('', '', '', '', '');
}

/**
 * Required by Gmail Add-Ons when authorization is needed.
 */
function onAuthorizationRequired(e, authorizationUrl) {
  var authAction = CardService.newAuthorizationAction()
    .setAuthorizationUrl(authorizationUrl);

  return CardService.newCardBuilder()
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph()
            .setText('Authorization is required to use the Arc add-on.')
        )
        .addWidget(
          CardService.newTextButton()
            .setText('Authorize')
            .setAuthorizationAction(authAction)
        )
    )
    .build();
}


// ─── Home Card ───────────────────────────────────────────────────────────────

/**
 * Builds the home card shown when the add-on icon is clicked.
 * This is the extension point — add new action buttons here for future features.
 *
 * @param {string} subject     Email subject (pre-fill for task title)
 * @param {string} senderName  Sender display name
 * @param {string} senderEmail Sender email address
 * @param {string} bodySnippet First 300 chars of email body
 * @param {string} threadUrl   Direct link to this Gmail thread
 */
function buildHomeCard(subject, senderName, senderEmail, bodySnippet, threadUrl) {
  var hasEmail = subject !== '';

  var section = CardService.newCardSection();

  if (hasEmail) {
    section.addWidget(
      CardService.newDecoratedText()
        .setTopLabel('Email subject')
        .setText(subject || '(no subject)')
        .setWrapText(true)
    );
  } else {
    section.addWidget(
      CardService.newTextParagraph()
        .setText('<b>The Arc</b> — Open an email to get started, or use the actions below.')
    );
  }

  // ── ACTION: Create CRM Task ──────────────────────────────────────────────
  var createTaskAction = CardService.newAction()
    .setFunctionName('showCreateTaskForm')
    .setParameters({
      subject:     subject,
      senderName:  senderName,
      senderEmail: senderEmail,
      bodySnippet: bodySnippet,
      threadUrl:   threadUrl
    });

  section.addWidget(
    CardService.newTextButton()
      .setText('📋  Create CRM Task')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(createTaskAction)
  );

  // ── Future actions go here ────────────────────────────────────────────────
  // Example:
  // section.addWidget(
  //   CardService.newTextButton()
  //     .setText('🔗  Link to Opportunity')
  //     .setOnClickAction(CardService.newAction().setFunctionName('showLinkOpportunityForm')...)
  // );

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('The Arc')
        .setSubtitle('Arcon Tools CRM')
        .setImageUrl('https://thearc.arconinc.com/favicon.ico')
        .setImageStyle(CardService.ImageStyle.CIRCLE)
    )
    .addSection(section)
    .build();
}


// ─── Create Task Form ─────────────────────────────────────────────────────────

/**
 * Renders the task creation form, pre-filled with email context.
 */
function showCreateTaskForm(e) {
  var params      = e.commonEventObject.parameters || {};
  var subject     = params.subject     || '';
  var senderName  = params.senderName  || '';
  var senderEmail = params.senderEmail || '';
  var bodySnippet = params.bodySnippet || '';
  var threadUrl   = params.threadUrl   || '';

  // Build description from email context
  var descParts = [];
  if (senderName || senderEmail) {
    descParts.push('From: ' + (senderName ? senderName + ' <' + senderEmail + '>' : senderEmail));
  }
  if (bodySnippet) {
    descParts.push('\n' + bodySnippet + (bodySnippet.length >= 300 ? '…' : ''));
  }
  if (threadUrl) {
    descParts.push('\nGmail thread: ' + threadUrl);
  }
  var defaultDescription = descParts.join('\n');

  // Default due date: +3 business days
  var defaultDueDate = getNextBusinessDate(3);

  // Fetch user list for assignee dropdown
  var users = [];
  var currentUserId = '';
  try {
    var userData = arcApiGet('/api/addon/users');
    users         = userData.users         || [];
    currentUserId = userData.currentUserId || '';
  } catch (err) {
    // If user fetch fails, fall back to an empty dropdown
  }

  // Build assignee dropdown items
  var assigneeItems = users.map(function(u) {
    return CardService.newSelectionInput(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('dummy'); // placeholder; we build this below
  });

  var assigneeDropdown = CardService.newSelectionInput(CardService.SelectionInputType.DROPDOWN)
    .setTitle('Assign to')
    .setFieldName('assigned_to');

  users.forEach(function(u) {
    assigneeDropdown.addItem(u.display_name, u.id, u.id === currentUserId);
  });
  if (users.length === 0) {
    assigneeDropdown.addItem('(me)', '', true);
  }

  // Build category dropdown
  var categoryDropdown = CardService.newSelectionInput(CardService.SelectionInputType.DROPDOWN)
    .setTitle('Category')
    .setFieldName('category');

  TASK_CATEGORIES.forEach(function(cat) {
    categoryDropdown.addItem(cat, cat, cat === 'To Do General');
  });

  // Build priority dropdown
  var priorityDropdown = CardService.newSelectionInput(CardService.SelectionInputType.DROPDOWN)
    .setTitle('Priority')
    .setFieldName('priority');

  TASK_PRIORITIES.forEach(function(p) {
    priorityDropdown.addItem(p.label, p.value, p.value === 'medium');
  });

  // Submit action — passes the email context params through
  var submitAction = CardService.newAction()
    .setFunctionName('handleCreateTask')
    .setParameters({
      senderName:  senderName,
      senderEmail: senderEmail,
      bodySnippet: bodySnippet,
      threadUrl:   threadUrl
    });

  // Back button
  var backAction = CardService.newAction().setFunctionName('handleBack');

  var formSection = CardService.newCardSection()
    .setHeader('New CRM Task')
    .addWidget(
      CardService.newTextInput()
        .setTitle('Title')
        .setFieldName('title')
        .setValue(subject || '')
        .setHint('Task title (required)')
    )
    .addWidget(
      CardService.newTextInput()
        .setTitle('Description')
        .setFieldName('description')
        .setValue(defaultDescription)
        .setMultiline(true)
    )
    .addWidget(assigneeDropdown)
    .addWidget(categoryDropdown)
    .addWidget(priorityDropdown)
    .addWidget(
      CardService.newTextInput()
        .setTitle('Due Date')
        .setFieldName('due_date')
        .setValue(defaultDueDate)
        .setHint('YYYY-MM-DD')
    );

  var buttonSet = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('Create Task')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(submitAction)
    )
    .addButton(
      CardService.newTextButton()
        .setText('Cancel')
        .setOnClickAction(backAction)
    );

  formSection.addWidget(buttonSet);

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Create CRM Task')
        .setSubtitle('The Arc')
    )
    .addSection(formSection)
    .build();
}


// ─── Submit Handler ───────────────────────────────────────────────────────────

/**
 * Handles the "Create Task" button submission.
 */
function handleCreateTask(e) {
  var formInputs  = e.commonEventObject.formInputs || {};
  var params      = e.commonEventObject.parameters || {};

  var title       = getFormValue(formInputs, 'title');
  var description = getFormValue(formInputs, 'description');
  var assignedTo  = getFormValue(formInputs, 'assigned_to');
  var category    = getFormValue(formInputs, 'category');
  var priority    = getFormValue(formInputs, 'priority');
  var dueDate     = getFormValue(formInputs, 'due_date');

  if (!title || !title.trim()) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification()
          .setText('Title is required.')
          .setType(CardService.NotificationType.ERROR)
      )
      .build();
  }

  try {
    var payload = {
      title:       title.trim(),
      description: description || null,
      assigned_to: assignedTo  || null,
      category:    category    || 'To Do General',
      priority:    priority    || 'medium',
      due_date:    dueDate     || null
    };

    var result = arcApiPost('/api/addon/tasks', payload);
    var task   = result.task;

    // Build success card
    var successSection = CardService.newCardSection()
      .addWidget(
        CardService.newDecoratedText()
          .setTopLabel('Task created')
          .setText(task.title)
          .setWrapText(true)
          .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CONFIRMATION_NUMBER_ICON))
      )
      .addWidget(
        CardService.newButtonSet()
          .addButton(
            CardService.newTextButton()
              .setText('View in The Arc')
              .setOpenLink(
                CardService.newOpenLink()
                  .setUrl(ARC_BASE_URL + '/crm/tasks/' + task.id)
                  .setOpenAs(CardService.OpenAs.FULL_SIZE)
              )
          )
          .addButton(
            CardService.newTextButton()
              .setText('Create Another')
              .setOnClickAction(
                CardService.newAction()
                  .setFunctionName('showCreateTaskForm')
                  .setParameters({
                    subject:     '',
                    senderName:  params.senderName  || '',
                    senderEmail: params.senderEmail || '',
                    bodySnippet: params.bodySnippet || '',
                    threadUrl:   params.threadUrl   || ''
                  })
              )
          )
          .addButton(
            CardService.newTextButton()
              .setText('Done')
              .setOnClickAction(CardService.newAction().setFunctionName('handleBack'))
          )
      );

    var successCard = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('Task Created!')
          .setSubtitle('The Arc CRM')
      )
      .addSection(successSection)
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(successCard))
      .build();

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification()
          .setText('Error: ' + err.message)
          .setType(CardService.NotificationType.ERROR)
      )
      .build();
  }
}

/**
 * Returns to the home card (used by Cancel / Done buttons).
 */
function handleBack(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popToRoot())
    .build();
}


// ─── API Helpers ──────────────────────────────────────────────────────────────

/**
 * Makes an authenticated GET request to the Arc API.
 * @param {string} path  API path, e.g. '/api/addon/users'
 * @returns {Object}     Parsed JSON response
 */
function arcApiGet(path) {
  var userEmail = Session.getActiveUser().getEmail();
  var response  = UrlFetchApp.fetch(ARC_BASE_URL + path, {
    method:             'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + getApiKey(),
      'X-User-Email':  userEmail
    }
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Arc API error (' + code + '): ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

/**
 * Makes an authenticated POST request to the Arc API.
 * @param {string} path     API path, e.g. '/api/addon/tasks'
 * @param {Object} payload  JSON body
 * @returns {Object}        Parsed JSON response
 */
function arcApiPost(path, payload) {
  var userEmail = Session.getActiveUser().getEmail();
  var response  = UrlFetchApp.fetch(ARC_BASE_URL + path, {
    method:             'post',
    muteHttpExceptions: true,
    contentType:        'application/json',
    payload:            JSON.stringify(payload),
    headers: {
      'Authorization': 'Bearer ' + getApiKey(),
      'X-User-Email':  userEmail
    }
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Arc API error (' + code + '): ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}


// ─── Utility Helpers ──────────────────────────────────────────────────────────

/**
 * Extracts a string value from Apps Script formInputs.
 * formInputs[field] is an object like { stringInputs: { value: ['val'] } }
 */
function getFormValue(formInputs, field) {
  var input = formInputs[field];
  if (!input) return '';
  var vals = input.stringInputs && input.stringInputs.value;
  return (vals && vals[0]) ? vals[0] : '';
}

/**
 * Returns a date string (YYYY-MM-DD) that is `n` business days from today.
 * Skips Saturdays (6) and Sundays (0).
 */
function getNextBusinessDate(n) {
  var date  = new Date();
  var count = 0;
  while (count < n) {
    date.setDate(date.getDate() + 1);
    var day = date.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  var yyyy = date.getFullYear();
  var mm   = String(date.getMonth() + 1).padStart(2, '0');
  var dd   = String(date.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}
