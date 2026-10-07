// Lanza firebase-tools respetando NO_PROXY.
// firebase-tools envía todo el tráfico HTTP por HTTPS_PROXY cuando está definido, incluso el
// tráfico entre emuladores locales; con un proxy corporativo eso rompe las reglas que consultan
// Firestore desde Storage y los disparadores entre emuladores. Sin proxy, no cambia nada.
const path = require('node:path');

const raiz = path.dirname(require.resolve('firebase-tools/package.json'));
const undici = require(require.resolve('undici', { paths: [raiz] }));

if (typeof undici.EnvHttpProxyAgent === 'function') {
  undici.ProxyAgent = class extends undici.EnvHttpProxyAgent {
    constructor(opciones) {
      const uri = typeof opciones === 'string' ? opciones : opciones.uri;
      super({ httpProxy: uri, httpsProxy: uri });
    }
  };
}

require(path.join(raiz, 'lib/bin/firebase.js'));
