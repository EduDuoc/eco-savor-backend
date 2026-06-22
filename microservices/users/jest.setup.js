// Polyfill para el driver de MongoDB v6+ que requiere globalThis.crypto
// en versiones de Node donde no está disponible globalmente.
const crypto = require('crypto');

if (!globalThis.crypto) {
  globalThis.crypto = {
    randomUUID: () => crypto.randomUUID(),
    getRandomValues: (arr) => crypto.randomFillSync(arr),
    subtle: undefined,
  };
}
