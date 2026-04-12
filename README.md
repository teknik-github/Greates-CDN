# Greates CDN

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A self-hosted CDN and secure file-sharing app built with Nuxt 4. Upload images with on-the-fly format conversion, publish public files, or create encrypted file links that require a passphrase before download. The app ships with a single-admin dashboard, JWT authentication, audit logging, and a dark mode UI.

![Greates CDN](./public/image.png)

## Features

- **Image upload** — convert uploads to `WEBP`, `AVIF`, `JPG`, or `PNG` with Sharp
- **Public file upload** — upload PDFs, videos, audio, documents, and archives up to `200 MB`
- **Encrypted file sharing** — optional passphrase protection using `AES-256-GCM` + `scrypt`
- **Protected file access page** — encrypted files are opened through `/f/:id` and decrypted only after the correct passphrase is submitted
- **Admin audit logs** — track failed decrypt attempts, busy decrypts, and public file-access probes from the dashboard
- **Dark mode** — system-aware theme with admin controls
- **JWT authentication** — single-admin login with `HttpOnly` session cookie
- **Security hardening** — file blocklist, login rate limit, decrypt rate limit, path traversal protection, and HTTP security headers

## Public URL Patterns

- Images: `https://yourdomain/images/<filename>`
- Public files: `https://yourdomain/files/<filename>`
- Encrypted files: `https://yourdomain/f/<id>`

## Requirements

- Node.js 18+
- npm

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy and fill in your values:

```bash
cp .env.example .env
```

`.env` variables:

| Variable | Description | Example |
|---|---|---|
| `NUXT_CDN_USERNAME` | Admin login username | `admin` |
| `NUXT_CDN_PASSWORD` | Admin login password | `your_secure_password` |
| `NUXT_JWT_SECRET` | Secret key for JWT signing (minimum 32 chars recommended) | `a_random_64_char_hex_string` |
| `NUXT_JWT_EXPIRY` | Session duration | `7d` |
| `NUXT_PUBLIC_BASE_URL` | Public base URL of the site | `https://cdn.yourdomain.com` |

## Development

```bash
npm run dev
```

The app starts at `http://localhost:3000`. Nuxt loads environment variables automatically from `.env`.

## Production

### Build

```bash
npm run build
```

### Run

Use either `npm start` or the provided startup script. Both load `.env` before the built Nuxt server starts.

```bash
npm start
```

or:

```bash
./start.sh
```

> `node .output/server/index.mjs` does not auto-load `.env`. Use `npm start` / `start.sh` unless your deployment platform injects environment variables itself.

### PM2

If you run the app with PM2, use the included ecosystem file so the server starts through `scripts/start.mjs` and reads `.env` automatically:

```bash
pm2 start ecosystem.config.cjs
```

Common PM2 commands:

```bash
pm2 restart greates-cdn
pm2 logs greates-cdn
pm2 save
```

## Recent Updates

- Added encrypted file sharing with passphrase-protected access pages
- Added admin audit logs with filter + export
- Added dark mode with system-aware theme support
- Added production bootstrap script so the built server can read `.env` automatically
- Added PM2 ecosystem config for production startup

## Admin Dashboard

After login, the admin dashboard provides:

- `Images` tab for converted image uploads
- `Files` tab for direct public file uploads
- `Encrypt` tab for passphrase-protected file uploads
- `Logs` page for audit events and exportable admin logs

## File Structure

```text
app/
  components/ThemeToggle.vue     # Theme control
  composables/useTheme.ts        # Light/dark/system theme state
  middleware/auth.ts             # Client-side anti-flicker auth guard
  pages/login.vue                # Admin login page
  pages/index.vue                # Main dashboard (Images / Files / Encrypt)
  pages/logs.vue                 # Admin audit log viewer
  pages/f/[id].vue               # Public encrypted-file access page

server/
  middleware/auth.ts             # Protects admin routes and admin APIs
  utils/auth.ts                  # signToken / verifyToken (jose)
  utils/db.ts                    # JSON metadata store with write mutex
  utils/storage.ts               # Path helpers with traversal protection
  utils/encryption.ts            # AES-256-GCM file encryption helpers
  utils/rateLimit.ts             # Login + decrypt rate limits / busy guards
  utils/audit.ts                 # Audit log write/read/rotation helpers
  api/auth/login.post.ts
  api/auth/logout.post.ts
  api/images/index.get.ts
  api/images/upload.post.ts
  api/images/[id].delete.ts
  api/files/index.get.ts
  api/files/upload.post.ts
  api/files/[id].delete.ts
  api/file-access/[id].get.ts    # Public encrypted-file metadata page data
  api/file-access/[id].post.ts   # Passphrase submit + decrypt download
  api/audit/logs.get.ts          # Protected admin audit list endpoint
  api/audit/logs/export.get.ts   # Protected admin audit export endpoint

public/
  images/                        # Public images served at /images/...
  files/                         # Public files served at /files/...

storage/
  files/                         # Encrypted files (not publicly served)

data/
  images.json                    # Image metadata (gitignored)
  files.json                     # File metadata (gitignored)
  audit.log                      # Audit log + rotated copies
```

## Storage Model

| Path | Purpose |
|---|---|
| `public/images/` | Converted image output |
| `public/files/` | Public file uploads |
| `storage/files/` | Encrypted file payloads |
| `data/images.json` | Image metadata |
| `data/files.json` | File metadata |
| `data/audit.log` | Audit trail for decrypt failures and public probes |

## Security

| Measure | Detail |
|---|---|
| Authentication | JWT stored in `cdn_session` (`HttpOnly`, `SameSite=strict`) |
| Client auth UX | `cdn_auth` flag cookie avoids client-side flicker after login |
| Login brute force protection | `10` failed login attempts per IP locks out for `15` minutes |
| Decrypt brute force protection | Failed decrypt attempts are rate-limited per `IP + fileId` |
| Decrypt resource guard | Busy guard limits concurrent decrypt work globally and per file |
| Encrypted storage | Protected files are stored in `storage/files/`, never exposed directly from `public/` |
| File upload protection | Dangerous file extensions and MIME types are blocked for public uploads |
| SVG protection | SVG is blocked for image uploads |
| Path traversal protection | `imagePath()`, `filePath()`, and `privateFilePath()` enforce safe resolved paths |
| Audit logging | Failed decrypt attempts, busy decrypts, and public metadata probes are logged to `data/audit.log` |
| HTTP headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are set in app config |
| HSTS | Add `Strict-Transport-Security` once TLS is confirmed on your deployment |

## Audit Logs

The admin `Logs` page shows recent security-relevant events and supports filter + export.

Events currently logged include:

- Failed decrypt attempts
- Decrypt requests blocked by rate limiting
- Decrypt requests rejected because the file is busy
- Public metadata probes to `/api/file-access/:id`

Audit logs are rotated automatically when the active file grows too large.

## Kubernetes / Docker

- `sharp` is configured as an external dependency. Do not bundle it away in production.
- Run `npm install --production` in your image so Sharp native binaries remain available.
- Mount persistent volumes for:
  - `/app/public/images`
  - `/app/public/files`
  - `/app/data`
  - `/app/storage`
- Pass all `NUXT_*` variables through Kubernetes `Secret` / `ConfigMap` or your runtime secret manager.

## Notes

- No automated test suite is configured in this repository.
- The decrypt and audit protections are in-memory / local-file based. If you scale to multiple instances, use shared storage and a shared rate-limit store.

## License

MIT — see [LICENSE](LICENSE)
