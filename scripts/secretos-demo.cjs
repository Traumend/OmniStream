// Escribe functions/.secret.local con valores de demostración para que el emulador no pida Secret Manager.
// No sobrescribe un archivo existente.
const { existsSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const ruta = join(__dirname, '..', 'functions', '.secret.local');
if (!existsSync(ruta)) {
  writeFileSync(
    ruta,
    [
      'CLAVE_CIFRADO=MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=',
      'META_APP_SECRET=demo-meta-secret',
      'GOOGLE_CLIENT_SECRET=demo-google-secret',
      'TIKTOK_CLIENT_SECRET=demo-tiktok-secret',
      '',
    ].join('\n'),
  );
}
