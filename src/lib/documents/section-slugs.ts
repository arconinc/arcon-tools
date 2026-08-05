export const SECTION_SLUGS: Record<string, string> = {
  'HR': 'hr',
  'Marketing': 'marketing',
  'Accounting': 'accounting',
  'E-Commerce': 'ecommerce',
  'Technology': 'technology',
  'Sales': 'sales',
  'Warehouse': 'warehouse',
}

export function sectionSlug(sectionName: string): string {
  return SECTION_SLUGS[sectionName] ?? sectionName.toLowerCase().replace(/[\s-]+/g, '')
}
