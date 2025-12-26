const bcrypt = require("bcrypt");

async function main() {
  const password = "Test123!";
  const hash = await bcrypt.hash(password, 12);

  const ok = await bcrypt.compare(password, hash);
  const fail = await bcrypt.compare("wrong", hash);

  if (!ok) throw new Error("bcrypt compare should be true");
  if (fail) throw new Error("bcrypt compare should be false");

  console.log("✅ bcrypt.test.js passed");
}

main().catch((e) => {
  console.error("❌ bcrypt.test.js failed:", e);
  process.exit(1);
});
