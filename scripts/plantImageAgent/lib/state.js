const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT } = require('./env');

/** Everything the agent produces lives here; it is gitignored and safe to delete. */
const WORKSPACE = path.join(PROJECT_ROOT, '.plant-image-agent');

const PATHS = {
  workspace: WORKSPACE,
  audit: path.join(WORKSPACE, 'audit.json'),
  verdicts: path.join(WORKSPACE, 'verdicts.json'),
  decisions: path.join(WORKSPACE, 'decisions.json'),
  ledger: path.join(PROJECT_ROOT, 'assets/plants/IMAGE_CREDITS.json'),
  searchCache: path.join(WORKSPACE, 'cache'),
  current: path.join(WORKSPACE, 'current'),
  candidates: path.join(WORKSPACE, 'candidates'),
  sheet: path.join(WORKSPACE, 'contact-sheet.html'),
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error.message}`);
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
  return file;
}

module.exports = { PATHS, WORKSPACE, ensureDir, readJson, writeJson };
