const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT } = require('./env');

const CATALOG_FILE = path.join(PROJECT_ROOT, 'src/data/plantDatabase.ts');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets/plants');
const ARRAY_HEADER = 'export const INDIVIDUAL_PLANTS: IndividualPlant[] = [';

/** Scan forward from an opening bracket to its match, ignoring brackets inside strings. */
function matchBracket(source, openIndex) {
  const open = source[openIndex];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unbalanced ${open} starting at ${openIndex}`);
}

function readField(block, field) {
  const match = block.match(new RegExp(`\\b${field}:\\s*['"\`]([^'"\`]*)['"\`]`));
  return match ? match[1] : undefined;
}

/** Parse every plant object in INDIVIDUAL_PLANTS, keeping source offsets for rewrites. */
function parseCatalog(content = fs.readFileSync(CATALOG_FILE, 'utf-8')) {
  const headerIndex = content.indexOf(ARRAY_HEADER);
  if (headerIndex === -1) throw new Error(`Could not find INDIVIDUAL_PLANTS in ${CATALOG_FILE}`);

  const arrayStart = headerIndex + ARRAY_HEADER.length - 1;
  const arrayEnd = matchBracket(content, arrayStart);
  const plants = [];

  let cursor = arrayStart + 1;
  while (cursor < arrayEnd) {
    const objectStart = content.indexOf('{', cursor);
    if (objectStart === -1 || objectStart > arrayEnd) break;
    const objectEnd = matchBracket(content, objectStart);
    const block = content.slice(objectStart, objectEnd + 1);
    const id = readField(block, 'id');
    if (id) {
      const requireMatch = block.match(/imageUrl:\s*require\(\s*['"]([^'"]+)['"]\s*\)/);
      plants.push({
        id,
        name: readField(block, 'name'),
        scientificName: readField(block, 'scientificName'),
        description: readField(block, 'description'),
        category: readField(block, 'category'),
        careLevel: readField(block, 'careLevel'),
        lightRequirement: readField(block, 'lightRequirement'),
        assetPath: requireMatch ? requireMatch[1] : null,
        assetFile: requireMatch ? path.basename(requireMatch[1]) : null,
        blockStart: objectStart,
        blockEnd: objectEnd,
      });
    }
    cursor = objectEnd + 1;
  }

  return { content, plants, arrayStart, arrayEnd };
}

/**
 * Point a plant's imageUrl at a new asset filename, adding the field when absent.
 * Returns updated file content; callers re-parse between edits because offsets shift.
 */
function setPlantAsset(content, plantId, assetFile) {
  const { plants } = parseCatalog(content);
  const plant = plants.find((entry) => entry.id === plantId);
  if (!plant) throw new Error(`Plant "${plantId}" not found in plantDatabase.ts`);

  const block = content.slice(plant.blockStart, plant.blockEnd + 1);
  const assetPath = `../../assets/plants/${assetFile}`;

  let updatedBlock;
  if (plant.assetPath) {
    updatedBlock = block.replace(
      /imageUrl:\s*require\(\s*['"][^'"]+['"]\s*\)/,
      `imageUrl: require('${assetPath}')`
    );
  } else {
    // Insert as the final field, matching the indentation of the block's other fields.
    const indent = block.match(/\n(\s+)\w+:/)?.[1] || '    ';
    updatedBlock = block.replace(/,?\s*\}$/, `,\n${indent}imageUrl: require('${assetPath}'),\n${indent.slice(0, -2)}}`);
  }

  return content.slice(0, plant.blockStart) + updatedBlock + content.slice(plant.blockEnd + 1);
}

module.exports = { CATALOG_FILE, ASSETS_DIR, parseCatalog, setPlantAsset };
