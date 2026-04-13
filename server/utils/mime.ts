const MIME_TYPES: Record<string, string> = {
  avif: 'image/avif',
  css: 'text/css; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  gif: 'image/gif',
  html: 'text/html; charset=utf-8',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  wav: 'audio/wav',
  webm: 'video/webm',
  webp: 'image/webp',
  xml: 'application/xml; charset=utf-8',
  zip: 'application/zip',
}

export function contentTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) {
    return 'application/octet-stream'
  }

  return MIME_TYPES[ext] ?? 'application/octet-stream'
}
