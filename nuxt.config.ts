// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],

  runtimeConfig: {
    cdnUsername: '',      // overridden by NUXT_CDN_USERNAME
    cdnPassword: '',      // overridden by NUXT_CDN_PASSWORD
    jwtSecret: '',        // overridden by NUXT_JWT_SECRET
    jwtExpiry: '7d',      // overridden by NUXT_JWT_EXPIRY
    public: {
      baseUrl: 'https://cdn.ourdomain.my.id', // overridden by NUXT_PUBLIC_BASE_URL
    },
  },

  nitro: {
    externals: {
      external: ['sharp'],
    },
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'X-XSS-Protection': '1; mode=block',
      },
    },
  },
})
