const bcrypt = require("bcrypt");
const argon2 = require("argon2");
const { profiles } = require("./profiles");
const { parseArgs } = require("./cli");

const WORDLIST = [
  "123456",
  "password",
  "qwerty",
  "letmein",
  "admin",
  "welcome",
  "p@ssword",
  "p@ssw0rd",
  "P@ssw0rd",
  "iloveyou",
];

function nowNs() {
  return process.hrtime.bigint();
}
function nsToMs(ns) {
  return Number(ns) / 1e6;
}

async function simulateBcrypt(hash) {
  const t0 = nowNs();
  for (const guess of WORDLIST) {
    const ok = await bcrypt.compare(guess, hash);
    if (ok) return { found: guess, elapsedMs: nsToMs(nowNs() - t0) };
  }
  return { found: null, elapsedMs: nsToMs(nowNs() - t0) };
}

async function simulateArgon2(hash) {
  const t0 = nowNs();
  for (const guess of WORDLIST) {
    const ok = await argon2.verify(hash, guess);
    if (ok) return { found: guess, elapsedMs: nsToMs(nowNs() - t0) };
  }
  return { found: null, elapsedMs: nsToMs(nowNs() - t0) };
}

async function main() {
  const args = parseArgs(process.argv);
  const profileName = (args.profile || "balanced").toString();
  const target = (args.target || "p@ssw0rd").toString();

  const p = profiles[profileName];
  if (!p) throw new Error(`Unknown profile: ${profileName}. Use light|balanced|hardcore`);

  console.log("=== Attack Simulation (wordlist) ===");
  console.log("Profile:", profileName);
  console.log("Target password (in wordlist by design):", target);
  console.log("");

  console.log("Creating bcrypt hash...");
  const bcryptHash = await bcrypt.hash(target, p.bcrypt.cost);

  console.log("Creating argon2id hash...");
  const argon2Hash = await argon2.hash(target, p.argon2);

  console.log("\n--- Trying guesses against bcrypt ---");
  const r1 = await simulateBcrypt(bcryptHash);
  console.log(`bcrypt -> found: ${r1.found} | time: ${r1.elapsedMs.toFixed(2)}ms`);

  console.log("\n--- Trying guesses against argon2id ---");
  const r2 = await simulateArgon2(argon2Hash);
  console.log(`argon2id -> found: ${r2.found} | time: ${r2.elapsedMs.toFixed(2)}ms`);

  console.log("\n✅ Pro vídeo: rode --profile=hardcore e compare lado a lado.");
}

main().catch((err) => {
  console.error("❌ Attack simulation failed:", err);
  process.exit(1);
});
