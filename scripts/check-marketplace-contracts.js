#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const specPath = path.join(repoRoot, 'server', 'openapi.yaml');
const spec = fs.readFileSync(specPath, 'utf8');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

function has(pattern, msg) {
  const ok = typeof pattern === 'string' ? spec.includes(pattern) : pattern.test(spec);
  if (!ok) fail(msg || `Missing ${pattern}`);
}

has('/products:', 'Missing /products path');
has(/\/products:\n\s+get:/, 'Missing GET /products');
has(/\/products:\n[\s\S]*?\n\s+post:/, 'Missing POST /products');
has('/products/{id}:', 'Missing /products/{id} path');
has('/products/{product_id}/image:', 'Missing /products/{product_id}/image path');
has('/cart:', 'Missing /cart path');
has('/cart/items:', 'Missing /cart/items path');
has('/cart/checkout:', 'Missing /cart/checkout path');
has("'401': { description: Unauthorized }", 'Missing 401 Unauthorized response');
has("'403': { description: Forbidden }", 'Missing 403 Forbidden response for cart/protected flow');
has("'409': { description: Conflict }", 'Missing 409 Conflict for cart checkout');
has('x-wallet-address', 'Missing x-wallet-address auth header documentation');

if (process.exitCode) process.exit(process.exitCode);
console.log('Marketplace contract coverage: OK');
