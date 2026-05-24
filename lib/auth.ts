import crypto from 'crypto';

/**
 * Hashes a plaintext password using Node's native high-performance scrypt algorithm.
 * @param password Plaintext password
 * @returns A promise resolving to "salt:derivedKey" hash string.
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Generate a unique 16-byte cryptographically secure salt
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Hash password with salt
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a plaintext password against a stored scrypt hash.
 * @param password Plaintext password to verify
 * @param hash Stored "salt:derivedKey" hash string
 * @returns A promise resolving to a boolean indicating verification success.
 */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return resolve(false);
    
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedBuffer = derivedKey;
      
      if (keyBuffer.length !== derivedBuffer.length) {
        return resolve(false);
      }
      resolve(crypto.timingSafeEqual(keyBuffer, derivedBuffer));
    });
  });
}
