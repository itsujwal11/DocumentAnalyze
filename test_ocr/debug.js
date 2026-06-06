const parseAmount = require('../server/config').parseAmount;

const line = '05/21/2022 | Website development 14 $40.00';
const parts = line.split(/\s{2,}|\t|\s*\|\s*/).filter(Boolean);
console.log('parts:', JSON.stringify(parts));

const nums = parts.map(p => {
  const cleaned = p.replace(/[$£€¥]/g, '');
  const val = parseAmount(cleaned);
  console.log('  re:', JSON.stringify(cleaned), '->', val);
  return val;
});
console.log('nums:', JSON.stringify(nums));
