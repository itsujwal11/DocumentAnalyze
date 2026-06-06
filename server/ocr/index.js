const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const pdfParse = require('pdf-parse');
const { TESS_PATH, PDFTOPPM_PATH, UPLOAD_DIR } = require('../config');

const CONC = 4;

async function runTesseract(imgPath, oem) {
  return new Promise((resolve, reject) => {
    execFile(TESS_PATH, [imgPath, 'stdout', '--psm', '4', '-l', 'eng', '--oem', String(oem)], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Tesseract OEM ${oem} failed: ${err.message}\n${stderr}`));
      resolve(stdout);
    });
  });
}

async function ocrImage(imagePath) {
  let ppPath = imagePath;
  try {
    const img = await Jimp.read(imagePath);
    ppPath = imagePath + '_pp.png';
    await img.greyscale().contrast(0.5).normalize().writeAsync(ppPath);
  } catch {}
  try {
    return await runTesseract(ppPath, 1);
  } catch {
    if (ppPath !== imagePath) fs.unlink(ppPath, () => {});
    try {
      return await runTesseract(imagePath, 0);
    } catch (e2) {
      throw new Error(`OCR failed: ${e2.message}`);
    }
  } finally {
    if (ppPath !== imagePath) {
      try { fs.unlinkSync(ppPath); } catch {}
    }
  }
}

async function extractPdf(filePath) {
  const { PDFParse } = pdfParse;
  const parser = new PDFParse({ url: filePath });
  const result = await parser.getText();
  return result.text || '';
}

async function ocrPdfPages(pdfPath) {
  const tmpDir = path.join(UPLOAD_DIR, 'pdf_pages_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    await new Promise((resolve, reject) => {
      execFile(PDFTOPPM_PATH, ['-png', '-r', '200', pdfPath, path.join(tmpDir, 'page')], { maxBuffer: 500 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error('pdftoppm failed: ' + err.message));
        resolve();
      });
    });
    const pages = fs.readdirSync(tmpDir).filter(f => /\.png$/i.test(f)).sort();
    if (pages.length === 0) return '';
    const texts = [];
    for (let i = 0; i < pages.length; i += CONC) {
      const batch = pages.slice(i, i + CONC);
      const results = await Promise.all(batch.map(p => ocrImage(path.join(tmpDir, p)).catch(() => '')));
      texts.push(...results);
    }
    return texts.filter(Boolean).join('\n--- Page Break ---\n');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function extractText(filePath, ext) {
  const imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'];
  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  } else if (ext === '.pdf') {
    try {
      const text = await extractPdf(filePath);
      if (text && text.trim().length > 20) {
        const garbageChars = (text.match(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
        if (garbageChars / text.length < 0.02) return text;
      }
    } catch {}
    return await ocrPdfPages(filePath);
  } else if (imgExts.includes(ext)) {
    return await ocrImage(filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function chunkText(text) {
  const CHUNK_SIZE = 500 * 1024;
  const sep = '\n--- Page Break ---\n';
  const parts = text.includes(sep) ? text.split(sep) : [text];
  const chunks = [];
  for (let p of parts) {
    if (p.length <= CHUNK_SIZE) { chunks.push(p); continue; }
    let pos = 0;
    while (pos < p.length) {
      let end = Math.min(pos + CHUNK_SIZE, p.length);
      if (end < p.length) {
        const nl = p.lastIndexOf('\n', end);
        if (nl > pos) end = nl;
      }
      chunks.push(p.slice(pos, end));
      pos = end;
    }
  }
  return chunks.filter(c => c.trim());
}

module.exports = { extractText, chunkText };
