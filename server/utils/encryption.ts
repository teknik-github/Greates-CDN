import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32
const SALT_LENGTH = 16

export const MIN_PASSPHRASE_LENGTH = 8

export interface FileEncryptionMetadata {
  salt: string
  iv: string
  authTag: string
}

async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return await scrypt(passphrase, salt, KEY_LENGTH) as Buffer
}

export async function encryptBuffer(
  data: Buffer,
  passphrase: string,
): Promise<{ encrypted: Buffer; metadata: FileEncryptionMetadata }> {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = await deriveKey(passphrase, salt)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encrypted,
    metadata: {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    },
  }
}

export async function decryptBuffer(
  data: Buffer,
  passphrase: string,
  metadata: FileEncryptionMetadata,
): Promise<Buffer> {
  const salt = Buffer.from(metadata.salt, 'base64')
  const iv = Buffer.from(metadata.iv, 'base64')
  const authTag = Buffer.from(metadata.authTag, 'base64')
  const key = await deriveKey(passphrase, salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(data), decipher.final()])
}
