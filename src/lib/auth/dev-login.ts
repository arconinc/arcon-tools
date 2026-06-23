const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function isLocalDevHost(hostname: string) {
  return LOCAL_DEV_HOSTNAMES.has(hostname.toLowerCase())
}

export function isLocalDevUrl(url: URL) {
  return isLocalDevHost(url.hostname)
}
