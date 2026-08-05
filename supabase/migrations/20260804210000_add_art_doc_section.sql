INSERT INTO doc_sections (name, sort_order)
SELECT 'Art', 9
WHERE NOT EXISTS (SELECT 1 FROM doc_sections WHERE name = 'Art');
