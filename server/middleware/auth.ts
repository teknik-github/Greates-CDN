import { verifyToken } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  const isProtected =
    path === '/' ||
    path === '/logs' ||
    path.startsWith('/api/images') ||
    path.startsWith('/api/files') ||
    path.startsWith('/api/audit')

  if (!isProtected) return

  const cookies = parseCookies(event)
  const token = cookies['cdn_session']

  if (!token) {
    if (path.startsWith('/api/')) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
    return sendRedirect(event, '/login')
  }

  const config = useRuntimeConfig(event)
  try {
    await verifyToken(token, config.jwtSecret)
  } catch {
    deleteCookie(event, 'cdn_session')
    if (path.startsWith('/api/')) {
      throw createError({ statusCode: 401, message: 'Token invalid or expired' })
    }
    return sendRedirect(event, '/login')
  }
})
