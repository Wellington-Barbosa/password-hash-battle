const argon2 = require("argon2");

async function main() {
  const password = "Test123!";
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 32 * 1024,
    timeCost: 2,
    parallelism: 1,
  });

  const ok = await argon2.verify(hash, password);
  const fail = await argon2.verify(hash, "wrong");

  if (!ok) throw new Error("argon2 verify should be true");
  if (fail) throw new Error("argon2 verify should be false");

  console.log("✅ argon2.test.js passed");
}

main().catch((e) => {
  console.error("❌ argon2.test.js failed:", e);
  process.exit(1);
});
