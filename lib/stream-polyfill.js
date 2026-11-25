// Safari antigo não sabe percorrer ReadableStream com "for await"; o PDF.js precisa disso.
if (typeof ReadableStream !== "undefined" && !ReadableStream.prototype[Symbol.asyncIterator]) {
  const it = async function* () {
    const r = this.getReader();
    try { for (;;) { const { done, value } = await r.read(); if (done) return; yield value; } }
    finally { r.releaseLock(); }
  };
  ReadableStream.prototype[Symbol.asyncIterator] = it;
  if (!ReadableStream.prototype.values) ReadableStream.prototype.values = it;
}
