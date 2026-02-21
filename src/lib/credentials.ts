import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, decrypt, buildAuthHeader, EncryptedData } from '@/lib/encryption'

interface CredentialRow {
  encrypted_username: string
  encrypted_password: string
  encryption_iv: string  // stored as JSON: {usernameIv, usernameTag, passwordIv, passwordTag}
  updated_at: string
}

interface StoredIvData {
  usernameIv: string
  usernameTag: string
  passwordIv: string
  passwordTag: string
}

export async function saveCredentials(
  userId: string,
  username: string,
  password: string
): Promise<void> {
  const encUser = encrypt(username)
  const encPass = encrypt(password)

  const ivData: StoredIvData = {
    usernameIv: encUser.iv,
    usernameTag: encUser.tag,
    passwordIv: encPass.iv,
    passwordTag: encPass.tag,
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('app_credentials')
    .upsert(
      {
        user_id: userId,
        encrypted_username: encUser.ciphertext,
        encrypted_password: encPass.ciphertext,
        encryption_iv: JSON.stringify(ivData),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) throw new Error(`Failed to save credentials: ${error.message}`)
}

export async function getAuthHeader(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('app_credentials')
    .select('encrypted_username, encrypted_password, encryption_iv')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  const row = data as CredentialRow
  const ivData: StoredIvData = JSON.parse(row.encryption_iv)

  const username = decrypt({
    ciphertext: row.encrypted_username,
    iv: ivData.usernameIv,
    tag: ivData.usernameTag,
  } as EncryptedData)

  const password = decrypt({
    ciphertext: row.encrypted_password,
    iv: ivData.passwordIv,
    tag: ivData.passwordTag,
  } as EncryptedData)

  return buildAuthHeader(username, password)
}

export async function hasCredentials(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_credentials')
    .select('id')
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function getCredentialUpdatedAt(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_credentials')
    .select('updated_at')
    .eq('user_id', userId)
    .single()
  return data?.updated_at ?? null
}
