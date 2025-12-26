const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const argon2 = require("argon2");

const { profiles } = require("./profiles");
const { parseArgs } = require("./cli");

// ===== Defaults =====
const DEFAULT_PASSWORD = "SuperSecret123!";
const DEFAULT_RUNS = 8;

// ===== Helpers =====
function nowNs() {
  return process.hrtime.bigint();
}
function nsToMs(ns) {
  return Number(ns) / 1e6;
}
function memMB() {
  const m = process.memoryUsage();
  return {
    rssMB: +(m.rss / 1024 / 1024).toFixed(2),
    heapUsedMB: +(m.heapUsed / 1024 / 1024).toFixed(2),
    externalMB: +(m.external / 1024 / 1024).toFixed(2),
  };
}
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = sum / values.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return {
    runs: values.length,
    avgMs: +avg.toFixed(2),
    p50Ms: +p50.toFixed(2),
    p95Ms: +p95.toFixed(2),
    minMs: +sorted[0].toFixed(2),
    maxMs: +sorted[sorted.length - 1].toFixed(2),
  };
}

function bar(ms, scale = 8) {
  // barra ASCII pro vídeo: quanto maior o ms, maior a barra
  const units = Math.max(1, Math.round(ms / scale));
  return "█".repeat(Math.min(units, 60));
}

function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

async function benchBcrypt(password, runs, cost) {
  const times = [];
  const memBefore = memMB();

  for (let i = 0; i < runs; i++) {
    const t0 = nowNs();
    await bcrypt.hash(password, cost);
    const t1 = nowNs();
    times.push(nsToMs(t1 - t0));
  }

  const memAfter = memMB();
  return {
    algo: "bcrypt",
    params: { cost },
    timesMs: times,
    memBefore,
    memAfter,
    stats: stats(times),
  };
}

async function benchArgon2(password, runs, options) {
  const times = [];
  const memBefore = memMB();

  for (let i = 0; i < runs; i++) {
    const t0 = nowNs();
    await argon2.hash(password, options);
    const t1 = nowNs();
    times.push(nsToMs(t1 - t0));
  }

  const memAfter = memMB();
  return {
    algo: "argon2id",
    params: options,
    timesMs: times,
    memBefore,
    memAfter,
    stats: stats(times),
  };
}

function printResult(title, bcryptR, argonR) {
  console.log(`\n=== ${title} ===`);
  console.log(pad("Algo", 10), pad("avg(ms)", 10), pad("p95(ms)", 10), "bar");
  console.log("-".repeat(60));

  console.log(
    pad("bcrypt", 10),
    pad(bcryptR.stats.avgMs.toFixed(2), 10),
    pad(bcryptR.stats.p95Ms.toFixed(2), 10),
    bar(bcryptR.stats.avgMs)
  );

  console.log(
    pad("argon2id", 10),
    pad(argonR.stats.avgMs.toFixed(2), 10),
    pad(argonR.stats.p95Ms.toFixed(2), 10),
    bar(argonR.stats.avgMs)
  );

  console.log("\nMem (after):");
  console.log("bcrypt  ->", bcryptR.memAfter);
  console.log("argon2id->", argonR.memAfter);
}

async function runOneProfile(profileName, password, runs) {
  const p = profiles[profileName];
  if (!p) throw new Error(`Unknown profile: ${profileName}. Use light|balanced|hardcore|all`);

  const bcryptR = await benchBcrypt(password, runs, p.bcrypt.cost);
  const argonR = await benchArgon2(password, runs, p.argon2);

  return { profile: profileName, bcryptR, argonR };
}

async function main() {
  const args = parseArgs(process.argv);

  const profile = (args.profile || "balanced").toString();
  const runs = Number(args.runs || DEFAULT_RUNS);
  const password = (args.password || DEFAULT_PASSWORD).toString();
  const saveJson = String(args.json || "true") !== "false";

  console.log("=== Password Hash Battle: Benchmark ===");
  console.log("Node:", process.version);
  console.log("Profile:", profile);
  console.log("Runs:", runs);

  const runAll = profile === "all";
  const profileNames = runAll ? Object.keys(profiles) : [profile];

  const results = [];
  for (const name of profileNames) {
    const r = await runOneProfile(name, password, runs);
    printResult(`PROFILE: ${name}`, r.bcryptR, r.argonR);
    results.push({
      profile: name,
      bcrypt: r.bcryptR,
      argon2id: r.argonR,
    });
  }

  if (saveJson) {
    const out = {
      meta: {
        createdAt: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        runs,
      },
      results,
    };

    const resultsDir = path.join(process.cwd(), "results");
    const outFile = path.join(resultsDir, "benchmark.json");
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf-8");
    console.log("\n✅ Saved:", outFile);
  }
}

main().catch((err) => {
  console.error("❌ Benchmark failed:", err);
  process.exit(1);
});
