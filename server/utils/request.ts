export function isSecureRequest(event: Parameters<typeof defineEventHandler>[0]): boolean {
  const forwardedProto = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0].trim().toLowerCase()
  if (forwardedProto) {
    return forwardedProto === 'https'
  }

  const forwardedSsl = getRequestHeader(event, 'x-forwarded-ssl')?.toLowerCase()
  if (forwardedSsl) {
    return forwardedSsl === 'on'
  }

  return getRequestURL(event).protocol === 'https:'
}
