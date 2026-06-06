const { BaseParser } = require('./base');
const { parseAmount, parseFlexDate } = require('../config');

class ReceiptParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      merchant: '',
      merchantAddress: '',
      date: '',
      receiptNumber: '',
      ticketNumber: '',
      items: [],
      subtotal: null,
      tax: null,
      total: null,
      taxRate: null,
      changeDue: null,
      paymentMethod: '',
      cashGiven: null,
      detectedTables: [],
      storeNumber: '',
      cashierName: '',
      terminalId: '',
    };

    this._extractMerchant(result, lines, text);
    this._extractDates(result, text);
    this._extractItems(result, lines, lowerText);
    this._extractTotals(result, text, lowerText);
    this._extractPayment(result, text, lines);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractMerchant(result, lines, text) {
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const l = lines[i].trim();
      if (l && l.length > 2 && l.length < 60 && !/^\d/.test(l)) {
        if (!/^(rech|mwst|entspricht|incl|es\s+bediente|bon|kasse|quittung|receipt|total|change|date|page|tax|item|qty|transaction|terminal|approv)/i.test(l)) {
          const alphaRatio = (l.match(/[A-Za-z\u00C0-\u024F\s]/g) || []).length / l.length;
          if (alphaRatio > 0.6) {
            result.merchant = l;
            break;
          }
        }
      }
    }
    if (!result.merchant) {
      // Skip noise lines for fallback
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (l && l.length > 2 && !/^\d/.test(l) && !/^(receipt|total|transaction|terminal|approv|subtotal|tax|change|cash|visa|mastercard)/i.test(l)) {
          const alphaRatio = (l.match(/[A-Za-z\u00C0-\u024F\s]/g) || []).length / l.length;
          if (alphaRatio > 0.6) { result.merchant = l; break; }
        }
      }
      if (!result.merchant) result.merchant = lines[0] || '';
    }

    const storeMatch = text.match(/store\s*(?:#|no|number)?[:\s]*(\d+)/i);
    if (storeMatch) result.storeNumber = storeMatch[1].trim();

    const cashierMatch = text.match(/cashier[:\s]*([A-Za-z0-9\s]{2,30})/i);
    if (cashierMatch) result.cashierName = cashierMatch[1].trim();

    const termMatch = text.match(/terminal[:\s]*(\d+)/i);
    if (termMatch) result.terminalId = termMatch[1].trim();
  }

  _extractDates(result, text) {
    const dateMatch = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dateMatch) {
      let a = parseInt(dateMatch[1]), b = parseInt(dateMatch[2]);
      let y = dateMatch[3];
      if (y.length === 2) y = '20' + y;
      if (b >= 1 && b <= 12 && (a > 12 || a === 0)) {
        // a is day, b is month
        result.date = `${y}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
      } else if (a >= 1 && a <= 12 && (b > 12 || b === 0)) {
        // a is month, b is day
        result.date = `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
      } else {
        // ambiguous: prefer MM/DD (first is month)
        result.date = `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
      }
    }
    const ticketMatch = text.match(/(?:ticket|bon|beleg)\s*(?:#|no|number)?[:\s]*(\d+)/i);
    if (ticketMatch) result.ticketNumber = ticketMatch[1].trim();
  }

  _extractItems(result, lines, lowerText) {
    const text = lines.join('\n');

    const receiptRe = /(\d*)\s*x\s*([A-Za-z\u00C0-\u024F][\w\u00C0-\u024F\s&.-]+?)\s+a\s+([\d,]+(?:\.\d{2})?)\s*(?:CHF|EUR|USD|GBP)?\s*([\d,]+(?:\.\d{2})?)/gi;
    let rm;
    while ((rm = receiptRe.exec(text)) !== null) {
      result.items.push({
        description: rm[2].trim().replace(/^[^A-Za-z\u00C0-\u024F]+/, ''),
        qty: parseInt(rm[1]) || 1,
        unitPrice: parseAmount(rm[3]),
        total: parseAmount(rm[4]),
      });
    }

    if (result.items.length === 0) {
      const tableStart = this._findTableStart(lines);
      if (tableStart >= 0) {
        for (let i = tableStart + 1; i < lines.length; i++) {
          const l = lines[i];
          if (/total|subtotal|tax|change|cash|visa|mastercard|amex|discover|maestro/i.test(l)) break;
          const parts = l.split(/\s{2,}|\t/).filter(Boolean);
          if (parts.length >= 2) {
            const amt = parseAmount(parts[parts.length - 1]);
            if (amt !== null) {
              const desc = parts.slice(0, -1).join(' ');
              if (desc.length > 1 && !/^\d+$/.test(desc)) {
                result.items.push({ description: desc, qty: 1, unitPrice: amt, total: amt });
              }
            }
          }
        }
      }
    }

    if (result.items.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        let l = lines[i];
        // Preprocess OCR garbles: ° → .  (decimal separator)
        l = l.replace(/°/g, '.');
        // Skip noise lines: totals, tax, payment info, dates, times, table numbers
        if (/total|subtotal|tax|vat|gst|change|cash|payment|visa|mastercard|charity|tip|service|^$|^\d+$|ord\s*#|dine\s*in|fssai|pos\s*gst|tel|tel\s*:|transaction|terminal|approv/i.test(l)) continue;
        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(l)) continue;
        if (/^\d{1,2}:\d{2}/.test(l)) continue;
        if (/^table\s+\d/i.test(l)) continue;
        // Handle "3x Item £15.75" format: capture qty multiplier
        const xMatch = l.match(/^(\d+)\s*x\s+(.+?)\s+[$€£¥]?\s*([\d,]+(?:\.\d{1,2})?)\s*$/);
        if (xMatch) {
          const qty = parseInt(xMatch[1]);
          const desc = xMatch[2].trim();
          const price = parseAmount(xMatch[3]);
          if (desc.length > 1 && qty > 0 && qty <= 99 && price !== null && price < 50000) {
            result.items.push({ description: desc, qty, unitPrice: price, total: price * qty });
            continue;
          }
        }
        // Handle "SOCKS 2 @ 4.99 9.98" format: desc qty @ unitPrice total
        const atMatch = l.match(/^(.+?)\s+(\d{1,3})\s+@\s+[$€£¥]?\s*([\d,]+(?:\.\d{1,2})?)\s+[$€£¥°]?\s*([\d,]+(?:\.\d{1,2})?)\s*$/);
        if (atMatch) {
          const desc = atMatch[1].trim();
          const qty = parseInt(atMatch[2]);
          const unitPrice = parseAmount(atMatch[3]);
          const total = parseAmount(atMatch[4]);
          if (desc.length > 1 && qty > 0 && qty <= 99 && unitPrice !== null && unitPrice < 50000) {
            result.items.push({ description: desc, qty, unitPrice, total: total || (unitPrice * qty) });
            continue;
          }
        }
        // Handle "SOCKS 2 @ 4.99" (no total) or garbled total
        const atMatchShort = l.match(/^(.+?)\s+(\d{1,3})\s+@\s+[$€£¥]?\s*([\d,]+(?:\.\d{1,2})?)\s*$/);
        if (atMatchShort) {
          const desc = atMatchShort[1].trim();
          const qty = parseInt(atMatchShort[2]);
          const unitPrice = parseAmount(atMatchShort[3]);
          if (desc.length > 1 && qty > 0 && qty <= 99 && unitPrice !== null && unitPrice < 50000) {
            result.items.push({ description: desc, qty, unitPrice, total: unitPrice * qty });
            continue;
          }
        }
        // try MEDITERREAN 8 1100.0 format: desc + qty + price
        const qtyMatch = l.match(/^([A-Za-z][A-Za-z\s]+?)\s+(\d{1,3})\s+([\d,]+(?:\.\d{1,2})?)$/);
        if (qtyMatch) {
          const desc = qtyMatch[1].trim();
          const qty = parseInt(qtyMatch[2]);
          const price = parseAmount(qtyMatch[3]);
          if (desc.length > 2 && qty > 0 && qty <= 99 && price !== null && price < 50000) {
            result.items.push({ description: desc, qty, unitPrice: price, total: price * qty });
            continue;
          }
        }
        // Fallback: grab trailing number as price
        const amtMatch = l.match(/([\d,]+(?:\.\d{1,2})?)\s*$/);
        if (amtMatch) {
          let desc = l.substring(0, l.lastIndexOf(amtMatch[1])).replace(/^[^a-zA-Z0-9]+/, '').trim();
          if (!desc && i > 0) desc = lines[i - 1].trim();
          desc = desc.replace(/[$€£¥]/g, '').replace(/\s+\d+[\d,.]*\s*$/, '').trim();
          if (desc && desc.length > 2 && !/^\d+$/.test(desc)) {
            const amt = parseAmount(amtMatch[1]);
            if (amt !== null && amt < 50000 && amt > 0) {
              result.items.push({ description: desc, qty: 1, unitPrice: amt, total: amt });
            }
          }
        }
      }
    }
  }

  _findTableStart(lines) {
    for (let i = 0; i < lines.length; i++) {
      const ll = lines[i].toLowerCase();
      if (/item|description|product|qty|quantity|article|pos|art/i.test(ll) &&
          (/\b(price|total|amount|cost|value|preis|betrag)\b/i.test(ll) || /€|\$|CHF/.test(ll))) {
        return i;
      }
    }
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const ll = lines[i].toLowerCase();
      if (/item|description|product|qty|article/i.test(ll)) return i;
    }
    return -1;
  }

  _extractTotals(result, text, lowerText) {
    const sub = text.match(/(?:subtotal|zwischensumme)[\s:.$€£¥]*([\d,]+(?:\.\d{1,2})?)/i);
    if (sub) result.subtotal = parseAmount(sub[1]);

    const total = text.match(/(?:^|\n)\s*(?:total|summe|sum|betrag|grand\s*total)[\s:.$€£¥\u00a0]*([\d,]+(?:\.\d{1,2})?)/im);
    if (total) {
      result.total = parseAmount(total[1]);
    } else {
      // fallback: match "total" anywhere but skip if preceded by "sub"
      const totalFallback = text.match(/(?<!\bsub)(?:\btotal\b|summe|sum|betrag)[\s:.$€£¥\u00a0]*([\d,]+(?:\.\d{1,2})?)/i);
      if (totalFallback) result.total = parseAmount(totalFallback[1]);
    }

    // Prefer tax amount after currency symbol (e.g. "vat 20.0% £16.88")
    const taxCurr = text.match(/(?:tax|vat|gst|mwst|ust)[\s\S]*?[$€£¥]\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (taxCurr) {
      result.tax = parseAmount(taxCurr[1]);
    } else {
      // Fallback: amount directly after keyword (not a % rate)
      const tax = text.match(/(?:tax|vat|gst|mwst|ust)[\s:.$€£¥]*?([\d,]+(?:\.\d{1,2})?)\s*$/im);
      if (tax) result.tax = parseAmount(tax[1]);
    }

    const taxPct = text.match(/(?:tax|vat|gst|mwst|ust)\s*\(?\s*([\d.]+)\s*%\)?/i);
    if (taxPct) result.taxRate = parseFloat(taxPct[1]);

    const change = text.match(/(?:change\s*due|change|rückgeld)[\s:.$]*([\d,]+(?:\.\d{1,2})?)/i);
    if (change) result.changeDue = parseAmount(change[1]);

    const cashGiven = text.match(/(?:cash|cash\s*given|bar\s|bezahlt)[\s:.$]*([\d,]+(?:\.\d{1,2})?)/i);
    if (cashGiven && !/change|rückgeld/i.test(cashGiven[0])) result.cashGiven = parseAmount(cashGiven[1]);

    if (result.total === null && result.items.length > 0) {
      const itemsTotal = result.items.reduce((s, i) => s + (i.total || i.unitPrice || 0), 0);
      if (itemsTotal > 0) result.total = itemsTotal;
    }
  }

  _extractPayment(result, text, lines) {
    const pmMap = [
      [/visa/i, 'Visa'], [/mastercard|mc\b/i, 'Mastercard'], [/amex|american\s*express/i, 'Amex'],
      [/discover/i, 'Discover'], [/maestro/i, 'Maestro'], [/\bach\b/i, 'ACH'],
      [/cash|bar\b/i, 'Cash'], [/check|cheque/i, 'Check'], [/ec[- ]?card|girocard/i, 'EC Card'],
      [/twint/i, 'Twint'], [/paypal/i, 'PayPal'], [/diners/i, 'Diners'],
      [/debit|ec[\s-]?card/i, 'Debit Card'], [/credit/i, 'Credit Card'],
    ];
    for (const [re, val] of pmMap) {
      if (re.test(text)) { result.paymentMethod = val; break; }
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'total', weight: 30, test: result.total !== null && result.total > 0 },
      { key: 'merchant', weight: 20, test: result.merchant && result.merchant.length > 2 },
      { key: 'items', weight: 20, test: result.items.length > 0 },
      { key: 'date', weight: 15, test: !!result.date },
      { key: 'paymentMethod', weight: 5, test: !!result.paymentMethod },
    ];
  }

  _validate(result) {
    const checks = this._getValidationChecks(result);
    this._runValidation(result, checks);
    this.result = result;
  }

  getExportData(result) {
    return {
      summary: {
        'Merchant': result.merchant,
        'Store Number': result.storeNumber,
        'Cashier': result.cashierName,
        'Terminal': result.terminalId,
        'Date': result.date,
        'Receipt Number': result.receiptNumber,
        'Ticket Number': result.ticketNumber,
        'Subtotal': result.subtotal,
        'Tax': result.tax,
        'Tax Rate': result.taxRate != null ? result.taxRate + '%' : '',
        'Total': result.total,
        'Cash Given': result.cashGiven,
        'Change Due': result.changeDue,
        'Payment Method': result.paymentMethod,
        'Item Count': result.items.length,
      },
      items: result.items.map((item, i) => ({
        '#': i + 1,
        'Description': item.description,
        'Qty': item.qty,
        'Unit Price': item.unitPrice,
        'Total': item.total,
      })),
      tables: result.detectedTables,
    };
  }
}

module.exports = { ReceiptParser };