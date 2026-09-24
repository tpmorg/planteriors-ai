const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

/** Read pixel dimensions with sips (macOS built-in, no native dependency to install). */
function getDimensions(file) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const width = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const height = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}

/** Write a downscaled JPEG copy — keeps the vision review cheap and matches how cards render. */
function makeThumbnail(source, dest, maxEdge = 384) {
  execFileSync('sips', ['-Z', String(maxEdge), '-s', 'format', 'jpeg', source, '--out', dest], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  return dest;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function looksLikeJpeg(file) {
  const buffer = Buffer.alloc(3);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buffer, 0, 3, 0);
  } finally {
    fs.closeSync(fd);
  }
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/**
 * Reproduce the Library compact card: a centered square cover crop at 104px.
 * Reviewers read this file instead of imagining what the CSS crop would show.
 */
function makeCardCrop(source, dest, size = 104) {
  const dimensions = getDimensions(source);
  if (!dimensions) throw new Error(`Cannot read ${source}`);
  const edge = String(Math.min(dimensions.width, dimensions.height));
  execFileSync('sips', ['--cropToHeightWidth', edge, edge, '-s', 'format', 'jpeg', source, '--out', dest], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  execFileSync('sips', ['-z', String(size), String(size), dest, '--out', dest], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  return dest;
}

/** Parse and bounds-check an `x,y,width,height` pixel box against the image it will crop. */
function parseBox(value, dimensions) {
  const parts = String(value).split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error('--box must be x,y,width,height in whole pixels');
  }
  const [x, y, width, height] = parts;
  if (!width || !height || x + width > dimensions.width || y + height > dimensions.height) {
    throw new Error(`--box ${value} falls outside the ${dimensions.width}x${dimensions.height} image`);
  }
  return { x, y, width, height };
}

/** Crop an exact pixel box. Core Graphics reads raw pixels, so EXIF-rotated sources are refused. */
function cropImage(source, dest, box) {
  const orientation = execFileSync('sips', ['-g', 'orientation', source], { encoding: 'utf-8' }).match(/orientation:\s*(\d+)/)?.[1];
  if (orientation && orientation !== '1') throw new Error(`${source} has EXIF orientation ${orientation}; crop coordinates would not match what is shown`);
  execFileSync('osascript', ['-l', 'JavaScript', require('path').join(__dirname, 'crop.jxa.js'),
    source, dest, String(box.x), String(box.y), String(box.width), String(box.height)], { stdio: ['ignore', 'ignore', 'pipe'] });
  return dest;
}

module.exports = { getDimensions, makeThumbnail, makeCardCrop, parseBox, cropImage, hashFile, looksLikeJpeg };
