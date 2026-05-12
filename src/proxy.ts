import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { RESTRICTED_RESOURCES } from '@/lib/permissions'

// Pre-compute the set of restricted page prefixes for fast lookup in middleware
const RESTRICTED_PAGE_PREFIXES: { prefix: string; role: string }[] = Object.entries(RESTRICTED_RESOURCES)
  .filter(([key, role]) => key.startsWith('page:') && !!role)
  .map(([key, role]) => ({ prefix: key.slice('page:'.length), role: role as string }))

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public paths
  if (
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/addon/') ||
    pathname.startsWith('/order/') ||
    pathname.startsWith('/api/public/')
  ) {
    // If already logged in and going to /login, redirect to dashboard
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // All other paths require authentication
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role check — only fires for explicitly restricted pages
  const restricted = RESTRICTED_PAGE_PREFIXES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')
  )
  if (restricted) {
    // Use service-role key to bypass RLS for this check
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Resolve effective user (impersonation aware)
    let effectiveUserId: string | null = null
    let isAdmin = false

    const { data: realUser } = await adminClient
      .from('users')
      .select('id, is_admin')
      .eq('google_id', user.id)
      .single()

    if (realUser) {
      isAdmin = realUser.is_admin
      effectiveUserId = realUser.id

      if (isAdmin) {
        const impersonateCookie = request.cookies.get('arcon_impersonate')
        if (impersonateCookie?.value) {
          const { data: target } = await adminClient
            .from('users')
            .select('id, is_admin')
            .eq('id', impersonateCookie.value)
            .is('deactivated_at', null)
            .single()
          if (target && !target.is_admin) {
            effectiveUserId = target.id
            isAdmin = false
          }
        }
      }
    }

    if (!isAdmin && effectiveUserId) {
      const [{ data: directRoles }, { data: deptRoles }] = await Promise.all([
        adminClient.from('user_roles').select('roles(name)').eq('user_id', effectiveUserId),
        adminClient.from('user_departments').select('department_roles(roles(name))').eq('user_id', effectiveUserId),
      ])
      const roleNames = new Set<string>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (directRoles ?? []) as any[]) if (r.roles?.name) roleNames.add(r.roles.name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const ud of (deptRoles ?? []) as any[]) for (const dr of ud.department_roles ?? []) if (dr.roles?.name) roleNames.add(dr.roles.name)
      if (!roleNames.has(restricted.role)) {
        const denied = new URL('/access-denied', request.url)
        denied.searchParams.set('resource', pathname)
        denied.searchParams.set('role', restricted.role)
        return NextResponse.redirect(denied)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
