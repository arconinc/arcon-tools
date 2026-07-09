export const EXPENSE_CATEGORIES = [
  '70200 MN Advertising/Memberships',
  '70201 AZ Advertising/Memberships',
  '70210 Meals/Customer Meeting',
  '70220 Customer Entertainment',
  '70230 Staff Meeting Meal/Expense',
  '70250 Company Events',
  '70300 Auto Maintenance/Fuel',
  '70400 Travel Expense',
  '77600 Office Supplies',
  '77700 Computer Supplies/Subscription',
  'TBD - Please describe',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

// Expensify CSV column → line item field mapping
export const EXPENSIFY_COLUMN_MAP: Record<string, string> = {
  'Date': 'expense_date',
  'Merchant': 'vendor',
  'Category': 'category',
  'Description': 'description',
  'Amount': 'original_amount',
  'Reimbursable': 'reimbursable',
  'Receipt URL': 'receipt_url',
}

// Expensify category name → internal EXPENSE_CATEGORIES value
export const EXPENSIFY_CATEGORY_MAP: Record<string, string> = {
  'Advertising':            '70200 MN Advertising/Memberships',
  'Benefits':               'TBD - Please describe',
  'Car':                    '70300 Auto Maintenance/Fuel',
  'Equipment':              '77700 Computer Supplies/Subscription',
  'Fees':                   'TBD - Please describe',
  'Home Office':            '77600 Office Supplies',
  'Insurance':              'TBD - Please describe',
  'Interest':               'TBD - Please describe',
  'Labor':                  'TBD - Please describe',
  'Maintenance':            '70300 Auto Maintenance/Fuel',
  'Materials':              'TBD - Please describe',
  'Meals and Entertainment':'70210 Meals/Customer Meeting',
  'Office Supplies':        '77600 Office Supplies',
  'Other':                  'TBD - Please describe',
  'Professional Services':  'TBD - Please describe',
  'Rent':                   'TBD - Please describe',
  'Taxes':                  'TBD - Please describe',
  'Travel':                 '70400 Travel Expense',
  'Utilities':              'TBD - Please describe',
}
