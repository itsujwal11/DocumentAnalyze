const { parseAmount } = require('./config');

function extractEntities(text) {
  const entities = [];
  const lowerText = text.toLowerCase();

  function add(type, value) {
    if (value == null) return;
    const v = String(value).trim();
    if (v && !entities.some(e => e.type === type && e.value === v)) {
      entities.push({ type, value: v });
    }
  }

  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let m; while ((m = emailRe.exec(text)) !== null) add('EMAIL', m[0]);

  const phoneRe = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
  while ((m = phoneRe.exec(text)) !== null) add('PHONE', m[0].trim());

  const dateRe = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g;
  while ((m = dateRe.exec(text)) !== null) add('DATE', m[0]);

  const amtRe = /[$€£₹]\s*[\d,]+(?:\.\d{2})?/g;
  while ((m = amtRe.exec(text)) !== null) add('AMOUNT', m[0]);

  const webRe = /(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  while ((m = webRe.exec(text)) !== null) add('WEBSITE', m[0].toLowerCase());

  const invRe = /(?:invoice\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const invM = text.match(invRe);
  if (invM) add('INVOICE_NUMBER', invM[1].trim());

  const receiptRe = /(?:receipt\s*(?:no|number|#|id)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const receiptM = text.match(receiptRe);
  if (receiptM) add('RECEIPT_NUMBER', receiptM[1].trim());

  const ticketRe = /(?:ticket\s*(?:no|number|#)?[:\s]*)([A-Z0-9][-A-Z0-9/]+)/i;
  const ticketM = text.match(ticketRe);
  if (ticketM) add('TICKET_NUMBER', ticketM[1].trim());

  const poRe = /(?:po|p\.?\s*o\.?|purchase\s*order)\s*(?:#|number|no)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const poM = text.match(poRe);
  if (poM) add('PO_NUMBER', poM[1].trim());

  const acctRe = /account\s*(?:number|no|#)[:\s]*(\d{6,20})/i;
  const acctM = text.match(acctRe);
  if (acctM) add('ACCOUNT_NUMBER', acctM[1].trim());

  const ibanRe = /\bIBAN[:\s]*([A-Z0-9]{10,34})\b/i;
  const ibanM = text.match(ibanRe);
  if (ibanM) add('IBAN', ibanM[1].trim());

  const bicRe = /\bBIC[:\s]*([A-Z0-9]{6,12})\b/i;
  const bicM = text.match(bicRe);
  if (bicM) add('BIC', bicM[1].trim());

  const custIdRe = /(?:customer|cust)\s*(?:id|#|no|number)[:\s]*([A-Z0-9][-A-Z0-9/]+)/i;
  const custIdM = text.match(custIdRe);
  if (custIdM) add('CUSTOMER_ID', custIdM[1].trim());

  if (/\$/.test(text)) add('CURRENCY', 'USD');
  else if (/€/.test(text)) add('CURRENCY', 'EUR');
  else if (/£/.test(text)) add('CURRENCY', 'GBP');
  else if (/₹/.test(text)) add('CURRENCY', 'INR');
  else if (/CHF|Fr\.?\b/i.test(text)) add('CURRENCY', 'CHF');

  return entities;
}

module.exports = { extractEntities };
