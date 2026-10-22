// Génère une paire de clés VAPID (P-256) au format attendu par send-push et le client.
// Usage : npx tsx scripts/gen-vapid.ts
import { webcrypto } from 'node:crypto';

// Cette méthode permet d'encoder des octets en base64url lorsqu'on affiche les clés.
function b64url(buf: ArrayBuffer | Uint8Array): string {
  return Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64url');
}

// Cette méthode permet de créer et d'afficher une nouvelle paire VAPID lorsqu'on prépare un environnement.
async function main(): Promise<void> {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await webcrypto.subtle.exportKey('raw', keys.publicKey);
  const jwk = await webcrypto.subtle.exportKey('jwk', keys.privateKey);
  console.log(`VAPID_PUBLIC_KEY=${b64url(pub)}`);
  console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
  console.log('# Côté app : VITE_VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY');
}

void main();
