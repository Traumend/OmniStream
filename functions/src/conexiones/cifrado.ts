import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SecretoCifrado {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export interface Cifrador {
  cifrar(texto: string): SecretoCifrado;
  descifrar(s: SecretoCifrado): string;
}

// AES-256-GCM con iv aleatorio de 12 bytes; todo en base64 para guardarlo en Firestore.
export function crearCifrador(claveBase64: string, keyVersion = 1): Cifrador {
  const clave = Buffer.from(claveBase64, 'base64');
  if (clave.length !== 32) throw new Error('La llave de cifrado debe tener 32 bytes en base64.');
  return {
    cifrar(texto) {
      const iv = randomBytes(12);
      const cifra = createCipheriv('aes-256-gcm', clave, iv);
      const ciphertext = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
      return {
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cifra.getAuthTag().toString('base64'),
        keyVersion,
      };
    },
    descifrar(s) {
      const descifra = createDecipheriv('aes-256-gcm', clave, Buffer.from(s.iv, 'base64'));
      descifra.setAuthTag(Buffer.from(s.authTag, 'base64'));
      return Buffer.concat([descifra.update(Buffer.from(s.ciphertext, 'base64')), descifra.final()]).toString('utf8');
    },
  };
}
