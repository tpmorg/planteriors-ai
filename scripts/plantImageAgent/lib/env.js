const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

/** Load .env.local (then .env) without adding a dependency. */
function loadEnv() {
  const env = {};
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    Object.assign(env, require('dotenv').parse(fs.readFileSync(fullPath)));
  }
  return { ...env, ...process.env };
}

module.exports = { loadEnv, PROJECT_ROOT };
