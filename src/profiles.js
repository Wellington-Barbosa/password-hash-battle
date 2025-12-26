// src/profiles.js
// Perfis pra rodar comparações "graváveis" e repetíveis

const argon2 = require("argon2");

const profiles = {
  light: {
    bcrypt: { cost: 10 },
    argon2: {
      type: argon2.argon2id,
      memoryCost: 32 * 1024, // 32MB
      timeCost: 2,
      parallelism: 1,
    },
  },
  balanced: {
    bcrypt: { cost: 12 },
    argon2: {
      type: argon2.argon2id,
      memoryCost: 64 * 1024, // 64MB
      timeCost: 3,
      parallelism: 1,
    },
  },
  hardcore: {
    bcrypt: { cost: 13 },
    argon2: {
      type: argon2.argon2id,
      memoryCost: 256 * 1024, // 256MB (aqui o Argon2 começa a ficar “impactante”)
      timeCost: 4,
      parallelism: 1,
    },
  },
};

module.exports = { profiles };
