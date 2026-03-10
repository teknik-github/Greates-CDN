export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/' && !to.path.startsWith('/dashboard')) return

  if (import.meta.client) {
    const hasCookie = document.cookie.includes('cdn_auth=')
    if (!hasCookie) {
      return navigateTo('/login')
    }
  }
})
