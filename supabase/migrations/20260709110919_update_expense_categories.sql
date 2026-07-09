-- Update expense report line items to use new category codes
-- This migration maps old category names to new accounting codes

UPDATE expense_report_line_items SET category = '70210 Meals/Customer Meeting' WHERE category = 'Meals & Entertainment';
UPDATE expense_report_line_items SET category = '70400 Travel Expense' WHERE category = 'Travel - Airfare';
UPDATE expense_report_line_items SET category = '70400 Travel Expense' WHERE category = 'Travel - Hotel';
UPDATE expense_report_line_items SET category = '70400 Travel Expense' WHERE category = 'Travel - Ground Transportation';
UPDATE expense_report_line_items SET category = '70300 Auto Maintenance/Fuel' WHERE category = 'Mileage';
UPDATE expense_report_line_items SET category = '70300 Auto Maintenance/Fuel' WHERE category = 'Parking & Tolls';
UPDATE expense_report_line_items SET category = '77600 Office Supplies' WHERE category = 'Office Supplies';
UPDATE expense_report_line_items SET category = '77700 Computer Supplies/Subscription' WHERE category = 'Software & Subscriptions';
UPDATE expense_report_line_items SET category = '77700 Computer Supplies/Subscription' WHERE category = 'Equipment';
UPDATE expense_report_line_items SET category = '77700 Computer Supplies/Subscription' WHERE category = 'Phone & Internet';

-- Map Professional Development and Marketing & Advertising to TBD for manual review
UPDATE expense_report_line_items SET category = 'TBD - Please describe' WHERE category = 'Professional Development';
UPDATE expense_report_line_items SET category = 'TBD - Please describe' WHERE category = 'Marketing & Advertising';

-- Map Client Gifts to Customer Entertainment
UPDATE expense_report_line_items SET category = '70220 Customer Entertainment' WHERE category = 'Client Gifts';

-- Map Other to TBD for manual review
UPDATE expense_report_line_items SET category = 'TBD - Please describe' WHERE category = 'Other';
