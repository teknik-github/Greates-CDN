# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server on :3000
npm run build      # production build to .output/
npm run preview    # preview production build
node .output/server/index.mjs  # run production build directly
```

No test suite is configured.

## Architecture

Nuxt 4 CDN-style image and file hosting app with a single admin user.

### Path Aliases (Critical)
- `~` resolves to `app/` (srcDir), **not** the project root
- Server files (`server/`) must use **relative imports** — never `~/server/utils/...` (resolves to `app/server/...` which doesn't exist)

### Authentication Flow
- Single admin user via env vars (`NUXT_CDN_USERNAME`, `NUXT_CDN_PASSWORD`)
- Login creates a HS256 JWT (`jose`) stored in two cookies:
  - `cdn_session` — HttpOnly, SameSite=strict (read by server middleware)
  - `cdn_auth` — JS-readable flag (read by client-side anti-flicker middleware in `app/middleware/auth.ts`)
- Server middleware (`server/middleware/auth.ts`) protects `/`, `/api/images/*`, `/api/files/*`
- Rate limiter (`server/utils/rateLimit.ts`): 10 failed logins per IP → 15-min lockout

### Storage Layout
| Path | Purpose |
|------|---------|
| `public/images/` | Converted images (served by Nitro static handler at `/images/...`) |
| `public/files/` | Public file uploads (served at `/files/...`) |
| `storage/files/` | Encrypted file uploads (NOT publicly served) |
| `data/images.json` | Image metadata store (gitignored) |
| `data/files.json` | File metadata store (gitignored) |

### Data Layer (`server/utils/db.ts`)
JSON file store with a write mutex to prevent race conditions. Two record types:
- `ImageRecord` — id, originalName, slug, formats[], uploadedAt, originalSize
- `FileRecord` — id, originalName, slug, filename, mimeType, size, uploadedAt, encryption?

### Image Uploads (`server/api/images/upload.post.ts`)
- Accepts `image` (file) + `format` (webp|avif|jpeg|png)
- Validates: `image/*` MIME, blocks SVG, max 20 MB
- Converts via `sharp` (configured as external dependency in `nuxt.config.ts` — native binaries must be preserved in production)

### File Uploads (`server/api/files/upload.post.ts`)
- Max 200 MB; blocklist of 30+ dangerous extensions (.php, .sh, .exe, .html, .js, etc.)
- Optional passphrase (min 8 chars) → AES-256-GCM encryption via `server/utils/encryption.ts` (scrypt key derivation) → saved to `storage/files/{slug}.enc`
- Encrypted files are accessed via `/f/[id]` (public page, no login) → `POST /api/file-access/[id]` with passphrase

### Path Safety
`server/utils/storage.ts` validates all file paths against traversal attacks before returning them.

## Environment Variables

```
NUXT_CDN_USERNAME=admin
NUXT_CDN_PASSWORD=changeme123
NUXT_JWT_SECRET=...
NUXT_JWT_EXPIRY=7d
NUXT_PUBLIC_BASE_URL=https://cdn.example.com
```

## Kubernetes Deployment

Volumes that must be mounted: `/app/public/images`, `/app/public/files`, `/app/data`, `/app/storage`
