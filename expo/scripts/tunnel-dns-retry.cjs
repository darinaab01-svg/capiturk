// Development-server only. Retry transient DNS failures for Expo tunnel hosts.
// Do not swallow process exceptions or change DNS servers / TLS validation.
const dns = require('node:dns');
const lookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  const originalArgs = Array.from(arguments);
  if (typeof options === 'function') { callback = options; options = undefined; }
  if (typeof callback !== 'function' || !hostname.endsWith('.on.expo.app')) {
    return lookup.apply(this, originalArgs);
  }
  let attempt = 0;
  function run() {
    lookup.call(dns, hostname, options, (error, ...result) => {
      if (error && ['ENOTFOUND', 'EAI_AGAIN'].includes(error.code) && attempt < 8) {
        attempt++;
        console.warn(`Expo tunnel DNS temporarily unavailable; retry ${attempt}/8`);
        setTimeout(run, Math.min(500 * 2 ** attempt, 5000));
      } else callback(error, ...result);
    });
  }
  run();
};
