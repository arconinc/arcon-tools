/**
 * Environment variable validation for production safety.
 * Validates critical vars at startup and provides clear error messages.
 * Does not expose secret values in logs.
 */

export interface EnvValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

// Environment variables that are required in production
const CRITICAL_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CREDENTIALS_ENCRYPTION_KEY',
  'CRON_SECRET',
]

// Environment variables that are required if a feature is used
const FEATURE_VARS: Record<string, string[]> = {
  email: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
  googleCalendar: ['GOOGLE_CALENDAR_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'],
  brandfetch: ['BRANDFETCH_API_KEY'],
  cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
  addon: ['ADDON_API_KEY'],
  promoBullit: ['PROMOBULLIT_AUTH'],
  expenseReports: ['EXPENSE_REPORT_REVIEWER_ID'],
}

// Optional vars with sensible defaults
const OPTIONAL_VARS: Record<string, string> = {
  GOOGLE_CALENDAR_CACHE_SECONDS: '900',
  GOOGLE_CALENDAR_LOOKAHEAD_DAYS: '180',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: 'https://thearc.arconinc.com',
}

function varExists(name: string): boolean {
  const value = process.env[name]
  return !!value && value.trim().length > 0
}

function varIsPlaceholder(value: string): boolean {
  if (!value) return true
  const lower = value.toLowerCase()
  return (
    lower.includes('your-') ||
    lower.includes('placeholder') ||
    lower.includes('xxx') ||
    value === '...'
  )
}

export function validateEnv(): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check critical vars
  for (const varName of CRITICAL_VARS) {
    const value = process.env[varName]
    if (!value) {
      errors.push(`Missing critical environment variable: ${varName}`)
    } else if (varIsPlaceholder(value)) {
      errors.push(`Environment variable ${varName} appears to be a placeholder; update it with a real value`)
    }
  }

  // Check for site URL consistency
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (siteUrl && appUrl && siteUrl !== appUrl && process.env.NODE_ENV === 'production') {
    warnings.push(
      `NEXT_PUBLIC_SITE_URL (${siteUrl}) and NEXT_PUBLIC_APP_URL (${appUrl}) differ; ensure they point to the same application`
    )
  }

  // Check features that are likely being used
  const likelyFeatures = ['email', 'googleCalendar', 'brandfetch']
  for (const feature of likelyFeatures) {
    const requiredVars = FEATURE_VARS[feature]
    const missing = requiredVars.filter(v => !varExists(v))

    if (missing.length > 0) {
      if (feature === 'email') {
        warnings.push(`Email feature: missing ${missing.join(', ')} — notifications will not send`)
      } else if (feature === 'googleCalendar') {
        warnings.push(`Google Calendar integration: missing ${missing.join(', ')} — calendar events will not load`)
      } else if (feature === 'brandfetch') {
        warnings.push(`Brandfetch integration: missing ${missing.join(', ')} — brand data will not be available`)
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

export function throwIfInvalidEnv(): void {
  const result = validateEnv()

  if (!result.ok) {
    const message = `Environment validation failed:\n${result.errors.map(e => `  • ${e}`).join('\n')}`
    throw new Error(message)
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('Environment warnings:', result.warnings)
  }
}
