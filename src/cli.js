// src/cli.js
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, vRaw] = a.split("=");
      const key = k.replace(/^--/, "");
      const next = argv[i + 1];
      const value =
        vRaw !== undefined ? vRaw : next && !next.startsWith("--") ? (i++, next) : true;
      args[key] = value;
    }
  }
  return args;
}

module.exports = { parseArgs };
