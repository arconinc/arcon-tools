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
