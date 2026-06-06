const fs = require('fs');
const path = require('path');

const receiptText = fs.readFileSync(path.join(__dirname, 'images_output', 'receiptExample.txt'), 'utf8');
const invoiceGarbled = fs.readFileSync(path.join(__dirname, 'images_output', 'invoiceExample.txt'), 'utf8');
const invoiceZylker = fs.readFileSync(path.join(__dirname, 'images_output', 'invoice_example.txt'), 'utf8');

const ReceiptParser = require('../server/parsers/receipt').ReceiptParser;
const InvoiceParser = require('../server/parsers/invoice').InvoiceParser;

console.log('=== RECEIPT PARSER ===');
const rp = new ReceiptParser(receiptText);
const rr = rp.extract();
console.log('Merchant:', JSON.stringify(rr.merchant));
console.log('Date:', JSON.stringify(rr.date));
console.log('Items:', rr.items?.length);
if (rr.items) rr.items.forEach((item, i) => console.log('  Item '+(i+1)+':', JSON.stringify(item)));
console.log('Subtotal:', rr.subtotal);
console.log('Total:', rr.total);
console.log('Payment:', rr.paymentMethod);
console.log('All non-empty fields:', Object.keys(rr).filter(k => rr[k] != null && rr[k] !== '' && !(Array.isArray(rr[k]) && rr[k].length === 0)).join(', '));

console.log('\n=== INVOICE PARSER (garbled) ===');
const ip1 = new InvoiceParser(invoiceGarbled);
const ir1 = ip1.extract();
console.log('Invoice#:', JSON.stringify(ir1.invoiceNumber));
console.log('Total:', ir1.total);
console.log('All non-empty fields:', Object.keys(ir1).filter(k => ir1[k] != null && ir1[k] !== '' && !(Array.isArray(ir1[k]) && ir1[k].length === 0)).join(', '));

console.log('\n=== INVOICE PARSER (Zylker) ===');
const ip2 = new InvoiceParser(invoiceZylker);
const ir2 = ip2.extract();
console.log('Invoice#:', JSON.stringify(ir2.invoiceNumber));
console.log('Vendor:', JSON.stringify(ir2.vendor));
console.log('Customer:', JSON.stringify(ir2.customer));
console.log('InvoDate:', JSON.stringify(ir2.invoiceDate));
console.log('Items:', ir2.items?.length);
if (ir2.items) ir2.items.forEach((item, i) => console.log('  Item '+(i+1)+':', JSON.stringify(item)));
console.log('Subtotal:', ir2.subtotal);
console.log('Tax:', ir2.taxAmount);
console.log('Total:', ir2.total);
console.log('BalanceDue:', ir2.balanceDue);
console.log('All non-empty fields:', Object.keys(ir2).filter(k => ir2[k] != null && ir2[k] !== '' && !(Array.isArray(ir2[k]) && ir2[k].length === 0)).join(', '));
