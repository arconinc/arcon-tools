import { createAdminClient } from '@/lib/supabase/admin'

export async function logAudit(params: {
  userId: string
  action: string
  storeId?: string
  orderId?: string
  details?: Record<string, unknown>
  status: 'success' | 'error' | 'partial'
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      user_id: params.userId,
      action: params.action,
      store_id: params.storeId ?? null,
      order_id: params.orderId ?? null,
      details: params.details ?? {},
      status: params.status,
    })
  } catch (err) {
    // Audit logging should never crash the main flow
    console.error('Failed to write audit log:', err)
  }
}
