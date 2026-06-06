function preprocessText(text) {
  if (!text) return '';
  let t = text;

  t = t.replace(/\r\n/g, '\n');
  t = t.replace(/\r/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/\uFFFD/g, '');
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  t = t.replace(/\$(\d+),\n(\d{3}\.\d{2})/g, '$$$1$2');
  t = t.replace(/(\d{1,3}(?:,\d{3})+)\n(\.\d{2})/g, '$1$2');
  t = t.replace(/(\d+)\n(\.\d{2})\b/g, '$1$2');
  t = t.replace(/([€£₹])\s*\n\s*(\d+)/g, '$1$2');
  t = t.replace(/(\d{1,3}(?:[.,]\d{3})*)\s*\n\s*(\.\d{2})\b/g, '$1$2');

  t = t.replace(/\bO\b/g, '0');
  t = t.replace(/\bl\b/g, '1');
  t = t.replace(/\bS\b/g, '5');

  t = t.replace(/[|][|]+/g, '|');
  t = t.replace(/[•·]/g, '');
  t = t.replace(/[–—]/g, '-');

  const lines = t.split('\n');
  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i].trimEnd();
    const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (cur && next &&
        cur.length > 5 && next.length > 3 &&
        /[,]\s*$/.test(cur) &&
        /^\d/.test(next)) {
      merged.push(cur + next);
      i++;
    } else if (cur && next &&
        cur.length > 3 && next.length > 2 &&
        /^[A-Za-z]/.test(cur) && /^[a-z]/.test(next) &&
        !/^\s*$/.test(cur) && !/^\s*$/.test(next) &&
        !cur.match(/\s{4,}/) && !next.match(/\s{4,}/) &&
        !cur.match(/\t/) && !next.match(/\t/)) {
      merged.push(cur + ' ' + next);
      i++;
    } else {
      merged.push(cur);
    }
  }

  return merged.join('\n');
}

module.exports = { preprocessText };