const fs = require('fs');
const path = require('path');
const BankStatementParser = require('../server/parsers/bank-statement').BankStatementParser;
const { generateExcel } = require('../server/export/excel');
const { generateCSV } = require('../server/export/csv');

async function main() {
  const ocrText = fs.readFileSync('bank_out.txt', 'utf8');
  const parser = new BankStatementParser(ocrText);
  const extracted = parser.extract();

  console.log('=== PARSED DATA ===');
  console.log('Type:', extracted.documentType);
  console.log('Bank:', extracted.bankName);
  console.log('Holder:', extracted.accountHolder);
  console.log('Account:', extracted.accountNumber);
  console.log('Period:', extracted.statementPeriod);
  console.log('Txns:', extracted.transactions.length);

  let totDebit = 0, totCredit = 0;
  extracted.transactions.forEach((t, i) => {
    totDebit += t.debit || 0;
    totCredit += t.credit || 0;
  });
  console.log('Totals - Debits:', totDebit.toFixed(2), 'Credits:', totCredit.toFixed(2));

  const records = extracted.transactions.map((t, i) => ({
    id: i + 1,
    date: t.date,
    description: t.description,
    type: t.type,
    debit: t.debit,
    credit: t.credit,
    balance: t.balance,
  }));

  const fields = { ...extracted };
  delete fields.transactions;

  const doc = {
    documentType: fields.documentType || 'BANK_STATEMENT',
    fileName: 'SampleBankStatement.png',
    rawText: ocrText,
    entities: [],
    fields,
    records,
    summary: {
      recordCount: records.length,
      totalDebit: totDebit,
      totalCredit: totCredit,
      netBalance: totCredit - totDebit,
    },
  };

  console.log('\n=== GENERATING EXCEL ===');
  const xlsxBuf = await generateExcel([doc]);
  fs.writeFileSync('test_output.xlsx', xlsxBuf);
  console.log('Excel written:', xlsxBuf.length, 'bytes');

  console.log('\n=== GENERATING CSV ===');
  const csv = await generateCSV([doc]);
  fs.writeFileSync('test_output.csv', csv, 'utf8');
  console.log('CSV written:', csv.length, 'bytes');
  console.log('\nFirst 2000 chars of CSV:');
  console.log(csv.substring(0, 2000));
}

main().catch(e => { console.error(e); process.exit(1); });
