import type { CrmTaskCategory, CrmTaskDepartment } from '@/types'

export const DEPARTMENTS: CrmTaskDepartment[] = [
  'CRM',
  'E-Commerce',
  'HR',
  'IT',
  'Accounting',
  'Sales',
  'Warehouse',
  'General',
]

export const DEPARTMENT_CATEGORIES: Record<CrmTaskDepartment, CrmTaskCategory[]> = {
  CRM: [
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
    'Waiting On Approval',
    'Waiting On Client Approval',
  ],
  'E-Commerce': [
    'Store/Ecommerce Adds',
    'Store/Ecommerce Refresh',
    'Store/Ecommerce QDesign',
    'Store/Ecommerce Update',
  ],
  Warehouse: [
    'Warehouse Fulfillment',
    'Warehouse Knitting',
    'Warehouse Ship',
    'Warehouse To Do',
  ],
  HR: [],
  IT: [],
  Accounting: [],
  Sales: [],
  General: ['To Do General'],
}

// Maps department → the route where its task board lives
export const DEPARTMENT_ROUTES: Record<CrmTaskDepartment, string> = {
  CRM: '/crm/tasks',
  'E-Commerce': '/ecommerce/tasks',
  HR: '/hr/tasks',
  IT: '/it/tasks',
  Accounting: '/accounting/tasks',
  Sales: '/sales/tasks',
  Warehouse: '/warehouse/tasks',
  General: '/my-tasks',
}

// Reverse map: route pathname → department
export const ROUTE_TO_DEPARTMENT: Record<string, CrmTaskDepartment> = {
  '/crm/tasks': 'CRM',
  '/ecommerce/tasks': 'E-Commerce',
  '/hr/tasks': 'HR',
  '/it/tasks': 'IT',
  '/accounting/tasks': 'Accounting',
  '/sales/tasks': 'Sales',
  '/warehouse/tasks': 'Warehouse',
}

// All categories in a flat list (for backwards-compat and general use)
export const ALL_CATEGORIES: CrmTaskCategory[] = [
  ...DEPARTMENT_CATEGORIES.CRM,
  ...DEPARTMENT_CATEGORIES['E-Commerce'],
  ...DEPARTMENT_CATEGORIES.Warehouse,
  ...DEPARTMENT_CATEGORIES.HR,
  ...DEPARTMENT_CATEGORIES.Accounting,
  ...DEPARTMENT_CATEGORIES.Sales,
  ...DEPARTMENT_CATEGORIES.General,
]
