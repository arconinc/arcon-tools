export const EXPENSE_CATEGORIES = [
  'Meals & Entertainment',
  'Travel - Airfare',
  'Travel - Hotel',
  'Travel - Ground Transportation',
  'Mileage',
  'Parking & Tolls',
  'Office Supplies',
  'Software & Subscriptions',
  'Equipment',
  'Phone & Internet',
  'Professional Development',
  'Marketing & Advertising',
  'Client Gifts',
  'Other',
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
  'Advertising':            'Marketing & Advertising',
  'Benefits':               'Other',
  'Car':                    'Travel - Ground Transportation',
  'Equipment':              'Equipment',
  'Fees':                   'Other',
  'Home Office':            'Office Supplies',
  'Insurance':              'Other',
  'Interest':               'Other',
  'Labor':                  'Other',
  'Maintenance':            'Other',
  'Materials':              'Other',
  'Meals and Entertainment':'Meals & Entertainment',
  'Office Supplies':        'Office Supplies',
  'Other':                  'Other',
  'Professional Services':  'Professional Development',
  'Rent':                   'Other',
  'Taxes':                  'Other',
  'Travel':                 'Travel - Ground Transportation',
  'Utilities':              'Other',
}
