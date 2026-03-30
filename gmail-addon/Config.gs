/**
 * Config.gs — Arc Gmail Add-On configuration
 *
 * ARC_API_KEY is stored in Script Properties (never hardcoded here).
 * Set it via: Extensions > Apps Script > Project Settings > Script Properties
 *   Key:   ARC_API_KEY
 *   Value: <the value of ADDON_API_KEY from .env.local / Vercel>
 */

var ARC_BASE_URL = 'https://thearc.arconinc.com';

/**
 * Returns the API key from Script Properties.
 * Throws a descriptive error if not configured.
 */
function getApiKey() {
  var key = PropertiesService.getScriptProperties().getProperty('ARC_API_KEY');
  if (!key) {
    throw new Error('ARC_API_KEY is not set. Go to Project Settings > Script Properties and add it.');
  }
  return key;
}

/**
 * Task category options — must match CrmTaskCategory in src/types/index.ts
 */
var TASK_CATEGORIES = [
  'To Do General',
  'Art Order',
  'Art Proactive Prospecting',
  'Art Rush - Drop Everything',
  'Art Rush - EOD',
  'Art Store Mocks',
  'Art Waiting on Approval',
  'CSR Order',
  'CSR Rush',
  'CSR To Do',
  'In Progress',
  'Need Changes',
  'Need Content',
  'Store/Ecommerce Adds',
  'Store/Ecommerce Refresh',
  'Store/Ecommerce QDesign',
  'Store/Ecommerce Update',
  'Waiting On Approval',
  'Waiting On Client Approval',
  'Warehouse Fulfillment',
  'Warehouse Knitting',
  'Warehouse Ship',
  'Warehouse To Do'
];

/**
 * Priority options — must match CrmTaskPriority in src/types/index.ts
 */
var TASK_PRIORITIES = [
  { label: 'Low',    value: 'low'    },
  { label: 'Medium', value: 'medium' },
  { label: 'High',   value: 'high'   }
];
