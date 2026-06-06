const fs = require('fs');
const path = require('path');
const text = fs.readFileSync(path.join(__dirname, 'images_output', 'bankstatementExample.txt'), 'utf8');
const lines = text.split('\n').filter(l => l.trim().length > 0);

const cleanOcrDate = s => s.replace(/O/g, '0').replace(/[fl]/g, '1').replace(/4ul/i, 'Jul');
const auDateRe = /^\s*(?:\(?\s*[\dOl]{1,2})[.\s_]+(?:[A-Za-z]{3,9}|4ul)\b/;

let matchCount = 0;
lines.forEach((l, i) => {
  const trimmed = l.trim().replace(/^[(\['"]+/, '').replace(/['"]+/g, '');
  const dateTest = cleanOcrDate(trimmed);
  const match = auDateRe.test(dateTest);
  if (match) {
    matchCount++;
    console.log((i + 1) + ' MATCH: ' + dateTest.substring(0, 60));
  }
});
console.log('\nTotal matches:', matchCount);

// debug first few lines
console.log('\n--- DEBUG ---');
for (let i = 25; i <= 30; i++) {
  const l = lines[i];
  const trimmed = l.trim().replace(/^[(\['"]+/, '').replace(/['"]+/g, '');
  const dateTest = cleanOcrDate(trimmed);
  console.log('line ' + (i+1) + ': ' + JSON.stringify(dateTest.substring(0, 40)) + ' -> ' + auDateRe.test(dateTest));
}
