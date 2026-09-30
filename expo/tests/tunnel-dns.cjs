const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../scripts/tunnel-dns-retry.cjs'), 'utf8');
function scenario(host, failures) {
  let calls = 0, retries = 0, result;
  const dns = { lookup(h, options, cb) {
    if (typeof options === 'function') cb = options;
    calls++;
    cb(calls <= failures ? Object.assign(new Error('DNS'), { code: 'ENOTFOUND' }) : null, '127.0.0.1', 4);
  }};
  vm.runInNewContext(source, { require: () => dns, console: { warn() {} }, setTimeout(fn) { retries++; fn(); } });
  dns.lookup(host, (error, address, family) => { result = { error, address, family }; });
  return { calls, retries, result };
}
const recovered = scenario('preview.on.expo.app', 2);
assert.equal(recovered.calls, 3);
assert.equal(recovered.result.error, null);
assert.equal(recovered.result.family, 4);
const permanent = scenario('preview.on.expo.app', 100);
assert.equal(permanent.calls, 9);
assert.equal(permanent.result.error.code, 'ENOTFOUND');
assert.equal(scenario('example.com', 2).calls, 1);
console.log('PASS: transient tunnel DNS retries, permanent failure remains bounded, other hosts unchanged.');
