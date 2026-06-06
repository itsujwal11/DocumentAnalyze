const { BaseParser } = require('./base');
const { STATE_ABBREVS, MONTHS, parseAmount, parseFlexDate } = require('../config');

const TABLE_HEADER_PATTERNS = [
  { cols: ['item', 'description', 'qty', 'rate', 'amount'], regex: /item.*desc.*qty.*rate.*amount/i },
  { cols: ['item', 'description', 'qty', 'unit.price', 'total'], regex: /item.*desc.*qty.*unit.*price.*total/i },
  { cols: ['description', 'qty', 'price', 'total'], regex: /desc.*qty.*price.*total/i },
  { cols: ['item', 'qty', 'price', 'amount'], regex: /item.*qty.*price.*amount/i },
  { cols: ['product', 'qty', 'rate', 'amount'], regex: /product.*qty.*rate.*amount/i },
  { cols: ['description', 'amount'], regex: /^(description|item).*amount$/i },
];

class InvoiceParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerLines = lines.map(l => l.toLowerCase());
    const lowerText = text.toLowerCase();

    const result = {
      invoiceNumber: '',
      invoiceDate: '',
      dueDate: '',
      vendor: { name: '', address: '', email: '', phone: '', taxId: '' },
      customer: { name: '', address: '', email: '', phone: '' },
      items: [],
      subtotal: null,
      taxRate: null,
      taxAmount: null,
      total: null,
      balanceDue: null,
      terms: '',
      detectedTables: [],
      poNumber: '',
      deliveryDate: '',
    };

    this._extractHeader(result, text, lines, lowerLines);
    this._extractParties(result, text, lines, lowerLines);
    this._extractTable(result, text, lines, lowerLines, lowerText);
    this._extractTotals(result, text, lowerText);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractHeader(result, text, lines, lowerLines) {
    const invNum = text.match(/(?:invoice\s*(?:no|number|#|id)[:\s'‘\u2018\u2019]{0,5})([A-Z0-9][-A-Z0-9/]{3,})/i);
    if (!invNum) {
      // fallback: \binv\b not followed by oice, with possible # or - prefix
      const invNum2 = text.match(/\binv\b(?!oice)[\s.#-]*([-A-Z0-9][-A-Z0-9/]{3,})/i);
      if (invNum2) result.invoiceNumber = invNum2[1].trim();
    }
    if (invNum) {
      const cand = invNum[1].trim();
      // Reject if it looks like a word (all letters, too short/long for invoice #)
      if (!/^[A-Za-z]+$/.test(cand) || cand.length > 12) result.invoiceNumber = cand;
    }
    // fallback: look for #number pattern like 'INVOICE NO.\nAirlift Industries #985433'
    if (!result.invoiceNumber) {
      const altInv = text.match(/#(\d{4,})/);
      if (altInv) result.invoiceNumber = altInv[1];
    }
    // fallback: INV-005 or INVO-005 pattern (common in simple invoices)
    if (!result.invoiceNumber) {
      const invCode = text.match(/\b(INV[OA]?-\d{2,})\b/i);
      if (invCode) result.invoiceNumber = invCode[1].toUpperCase();
    }

    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const l = lines[i];
      if (l && !/invoice|date|page|total|tax|amount|receipt|statement|rech|mwst|entspricht|es\s+bediente|billing|shipping|company\s*name|address|phone|email/i.test(l) && !/^\d/.test(l) && l.length > 2 && l.length < 60) {
        const alphaRatio = (l.match(/[A-Za-z\s]/g) || []).length / l.length;
        if (alphaRatio > 0.6 && l.split(/\s+/).length >= 2) {
          result.vendor.name = l.replace(/^[^A-Za-z0-9]+/, '').trim();
          break;
        }
      }
    }
    // Fallback: find a non-noise line that looks like a vendor name
    if (!result.vendor.name) {
      for (let i = 0; i < Math.min(6, lines.length); i++) {
        const l = lines[i];
        if (l && l.length > 3 && l.length < 60 && !/^\d/.test(l) && !/invo|receipt|statement|date|page|total|tax|billing|shipping|company|address|phone|email|description|quantity|unit\s*price/i.test(l) && l.split(/\s+/).length >= 2) {
          const cleaned = l.replace(/~{2,}.*$/, '').trim();
          if (cleaned && cleaned.length > 2) {
            result.vendor.name = cleaned;
            break;
          }
        }
      }
    }

    const dates = [];
    const dRe = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g;
    let m;
    while ((m = dRe.exec(text)) !== null) {
      const parts = m[1].split(/[-/]/);
      // normalize to YYYY-MM-DD
      if (parts[0].length === 4) dates.push(parts[0] + '-' + parts[1].padStart(2,'0') + '-' + parts[2].padStart(2,'0'));
      else dates.push(parts[2].length === 2 ? '20' + parts[2] : parts[2] + '-' + parts[0].padStart(2,'0') + '-' + parts[1].padStart(2,'0'));
    }

    const issueMatch = text.match(/(?:issue\s*date|date\s*of\s*issue|issued|invoice\s*date)[:\s]*([A-Za-z0-9\s,-]{3,30}?)(?:\n|$)/i);
    if (issueMatch) {
      const val = issueMatch[1].trim();
      // Only accept if it looks like a date
      if (/^[A-Za-z]/.test(val) && !/\d/.test(val)) {
        // It's a word, not a date — likely "Billing Details" or similar
      } else {
        result.invoiceDate = parseFlexDate(val);
      }
    }

    const dueMatch = text.match(/(?:due\s*date|payment\s*due|due\s*by|payable\s*by)[:\s]*([A-Za-z0-9\s,-]+?)(?:\n|$)/i);
    if (dueMatch) result.dueDate = parseFlexDate(dueMatch[1].trim());

    if (!result.invoiceDate && dates.length > 0) result.invoiceDate = dates[0];
    if (!result.dueDate && dates.length > 1) result.dueDate = dates[1];

    // Fallback: if invoice number found, look for the next date-like string
    if (!result.invoiceDate && result.invoiceNumber) {
      const numIdx = text.indexOf(result.invoiceNumber);
      if (numIdx >= 0) {
        const afterNum = text.substring(numIdx + result.invoiceNumber.length);
        // Try dd-Mon-YY, dd-Mon-YYYY, MM/DD/YYYY, etc.
        const dateFromNum = afterNum.match(/(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})/);
        if (dateFromNum) {
          result.invoiceDate = parseFlexDate(dateFromNum[0].trim());
        } else {
          // Try unsectioned date after invoice number
          const dateFromNum2 = afterNum.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
          if (dateFromNum2) result.invoiceDate = parseFlexDate(dateFromNum2[1].trim());
        }
      }
    }

    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (email) result.vendor.email = email[0];

    const phone = text.match(/(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phone) result.vendor.phone = phone[0].trim();

    const termsMatch = text.match(/(?:payment\s*terms|terms|due\s*on|due\s*upon|net\s+\d+)[:\s]*([A-Za-z0-9\s,-]{3,60})/i);
    if (termsMatch) result.terms = termsMatch[1].trim();

    const poMatch = text.match(/(?:po\s*(?:number|#|no)|purchas\s*order)[:\s]*([A-Z0-9][-A-Z0-9/]+)/i);
    if (poMatch) result.poNumber = poMatch[1].trim();
  }

  _extractParties(result, text, lines, lowerLines) {
    const billBlock = this._extractBlock('bill to', lines, 4);
    // Fallback: search for "billing information" block
    if (!billBlock) {
      const billIdx = lowerLines.findIndex(l => l.includes('billing information'));
      if (billIdx >= 0) {
        const parts = [];
        for (let j = billIdx + 1; j < Math.min(billIdx + 7, lines.length); j++) {
          const l = lines[j];
          if (!l || /^(invoice|date|page|total|tax|subtotal|amount|phone|email|account|payment|due|ship|bill|order|item|qty|quantity|unit|price|discount|shipping|description|freight|handling|reference|ref|check|authorization|auth|terminal|store|cashier|reg|terms|remit|make all|legal|thank)[\s:]/i.test(l)) break;
          parts.push(l);
        }
        const addr = parts.join(', ').trim();
        if (addr) {
          result.customer.address = addr;
          // Extract name: skip label-only lines like "Company Name Name", "Address Address"
          const firstReal = parts.find(p => p && !/^(company\s*name|address|phone|email)/i.test(p.trim()) && p.trim().length > 3);
          if (firstReal) {
            const namePart = firstReal.split(',')[0].trim();
            if (namePart.length > 2 && !/^(company|address|phone|name)/i.test(namePart)) {
              result.customer.name = namePart;
            }
          }
        }
      }
    }
    if (billBlock) {
      const parts = billBlock.split(',').map(p => p.trim());
      const nameCandidate = parts[0].replace(/bill[o\s]*ship\s*to/i, '').trim();
      if (nameCandidate.length > 2) result.customer.name = nameCandidate;
      result.customer.address = billBlock;
    }

    const shipBlock = this._extractBlock('ship to', lines, 4);
    // Fallback: search for "shipping information" block (only if billing didn't already find data)
    if (!result.customer.address && !shipBlock) {
      const shipIdx = lowerLines.findIndex(l => l.includes('shipping information'));
      if (shipIdx >= 0) {
        const parts = [];
        for (let j = shipIdx + 1; j < Math.min(shipIdx + 7, lines.length); j++) {
          const l = lines[j];
          if (!l || /^(invoice|date|page|total|tax|subtotal|amount|phone|email|account|payment|due|ship|bill|order|item|qty|quantity|unit|price|discount|shipping|freight|handling|reference|ref|check|authorization|auth|terminal|store|cashier|reg|terms|remit|make all|legal|thank)[\s:]/i.test(l)) break;
          parts.push(l);
        }
        if (parts.length > 0) {
          const addr = parts.join(', ').trim();
          if (!result.customer.name) result.customer.name = (parts[0] || '').split(',')[0].trim();
          result.customer.address = (result.customer.address ? result.customer.address + ' | ' : '') + addr;
        }
      }
    }
    if (shipBlock) {
      if (!result.customer.name) result.customer.name = shipBlock.split(',')[0].trim();
      result.customer.address = (result.customer.address ? result.customer.address + ' | ' : '') + shipBlock;
    }

    const addrLines = lines.filter(l =>
      /street|st\.?|drive|dr\.?|avenue|ave|road|rd\.?|blvd|ct\.?|ln\.?|way|circle|p\.?\s*o\.?\s*box|suite|ste/i.test(l) ||
      STATE_ABBREVS.test(l)
    );
    if (addrLines.length > 0 && !result.customer.address) {
      result.customer.address = addrLines.join('; ');
    }

    const custId = text.match(/(?:customer|cust)\s*(?:id|#|no|number)[:\s]*([A-Z0-9][-A-Z0-9/]+)/i);
    if (custId) result.customer.id = custId[1].trim();
  }

  _extractBlock(label, lines, maxExtra) {
    const fuzzy = label.split(/\s+/).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const ll = lines[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      const ll_orig = lines[i];
      // check if ALL label words appear in order with at most 10 non-alpha chars between any two
      const fuzzyRe = new RegExp(fuzzy.map((w, idx) => idx === 0 ? w : '.{0,10}' + w).join(''));
      if (fuzzyRe.test(ll)) {
        const afterLabel = lines[i].replace(new RegExp(fuzzy.map((w, idx) => idx === 0 ? '(?:' + w + ')[a-z]*' : '.{0,10}' + '(?:' + w + ')[a-z]*').join(''), 'i'), '');
        const parts = [
          afterLabel.replace(/^[:\s]+/, ''),
        ];
        for (let j = i + 1; j < Math.min(i + 1 + maxExtra, lines.length); j++) {
          const l = lines[j];
          if (!l) break;
          if (/^(invoice|date|page|total|tax|subtotal|amount|phone|email|account|payment|due|ship|bill|order|item|qty|quantity|unit|price|discount|shipping|freight|handling|reference|ref|check|authorization|auth|terminal|store|cashier|reg|terms|remit|make all|legal|thank)[\s:]/i.test(l)) break;
          if (/\s*\|\s*/.test(l)) break;  // pipe-separated data = line items, not address
          parts.push(l);
        }
        return parts.filter(Boolean).join(', ').trim();
      }
    }
    return '';
  }

  _extractTable(result, text, lines, lowerLines, lowerText) {
    const tableStart = this._findTableStart(lines, lowerLines);
    if (tableStart === -1) {
      result.items = this._regexLineExtraction(text);
      // Same sanity filter as below
      result.items = result.items.filter(item => {
        if (!item) return false;
        if (item.qty != null && (item.qty > 10000 || item.qty <= 0)) return false;
        if (item.amount != null && (item.amount > 100000000 || item.amount < 0)) return false;
        if (item.rate != null && (item.rate > 100000000 || item.rate < 0)) return false;
        if (item.description && /^\d+$/.test(item.description)) return false;
        return true;
      });
      return;
    }

    let rowIdx = tableStart + 1;
    const tableRows = [];

    while (rowIdx < lines.length) {
      const l = lines[rowIdx];
      const ll = lowerLines[rowIdx];

      if (!l) { rowIdx++; continue; }

      if (/^[\s]*$/.test(l) || /total|subtotal|tax|shipping|thank|make all|payable|balance|opening|closing/i.test(ll)) break;

      tableRows.push(l);
      rowIdx++;
    }

    result.items = this._parseTableRows(tableRows);
    if (result.items.length === 0) {
      result.items = this._regexLineExtraction(text);
    }

    // Sanity filter: remove items with invalid qty/rate/amount
    result.items = result.items.filter(item => {
      if (!item) return false;
      if (item.qty != null && (item.qty > 10000 || item.qty <= 0)) return false;
      if (item.amount != null && (item.amount > 100000000 || item.amount < 0)) return false;
      if (item.rate != null && (item.rate > 100000000 || item.rate < 0)) return false;
      if (item.description && /^\d+$/.test(item.description)) return false;
      return true;
    });
  }

  _parseTableRows(rows) {
    const items = [];
    for (const row of rows) {
      const item = this._parseRow(row);
      if (item) items.push(item);
    }
    return items;
  }

  _parseRow(row) {
    const parts = row.split(/\s{2,}|\t|\s*\|\s*/).filter(Boolean);
    if (parts.length < 2) {
  
      // Single-space columns: try to parse as "desc qty rate amount"
      const tokens = row.trim().split(/\s+/);
      const numIndices = tokens.map((t, i) => parseAmount(t.replace(/[$£€¥]/g, '')) !== null ? i : -1).filter(i => i >= 0);
      if (numIndices.length >= 3) {
        const amounts = numIndices.map(i => parseAmount(tokens[i].replace(/[$£€¥]/g, '')));
        const lastIdx = numIndices[numIndices.length - 1];
        const secondLastIdx = numIndices[numIndices.length - 2];
        const thirdLastIdx = numIndices[numIndices.length - 3];
        const desc = tokens.slice(0, thirdLastIdx).join(' ');
        const qty = parseInt(tokens[thirdLastIdx]);
        if (desc.length > 0 && qty > 0 && qty <= 10000 && amounts.length >= 3) {
          const item = {
            item: desc, description: desc,
            qty: qty,
            rate: amounts[amounts.length - 2],
            amount: amounts[amounts.length - 1],
          };
          if (item.amount !== null && item.amount < 100000000) return item;
        }
      }
      if (numIndices.length >= 2) {
        const lastIdx = numIndices[numIndices.length - 1];
        const prevIdx = numIndices[numIndices.length - 2];
        const desc = tokens.slice(0, prevIdx).join(' ');
        const qty = parseInt(tokens[prevIdx]);
        if (desc.length > 0 && qty > 0 && qty <= 10000) {
          const item = {
            item: desc, description: desc,
            qty: qty,
            rate: null,
            amount: parseAmount(tokens[lastIdx].replace(/[$£€¥]/g, '')),
          };
          if (item.amount !== null && item.amount < 100000000) return item;
        }
      }
      return null;
    }

    // Skip template/noise rows
    const joined = parts.join(' ').toLowerCase();
    if (/optional\s*field|add\s+(address|company|name)|gstin|pan\s|mobile|phone/i.test(joined)) return null;

    // Validate and return item if it passes sanity checks
    function isValidItem(item) {
      if (!item) return false;
      if (item.qty != null && (item.qty > 10000 || item.qty <= 0)) return false;
      if (item.amount != null && (item.amount > 100000000 || item.amount < 0)) return false;
      if (item.rate != null && (item.rate > 100000000 || item.rate < 0)) return false;
      if (item.description && /^\d+$/.test(item.description)) return false;
      return true;
    }

    // Remove date-like first part (DATE | ... format)
    let datePart = null;
    const cleaned = parts[0].replace(/^[^0-9]+/, '');
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(parts[0]) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(cleaned) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(parts[0])) {
      datePart = parts.shift().replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '');
    }

    // After date removal: single element like "Website development 14 $40.00"
    if (parts.length === 1 && datePart) {
      const text = parts[0];
      // try: description hours $rate  (e.g. "Website development 14 $40.00")
      let m = text.match(/^(.+?)\s{2,}(\d{1,3})\s+\$?([\d,]+(?:\.\d{1,2})?)$/);
      if (!m) m = text.match(/^(.+?)\s+(\d{1,3})\s+\$?([\d,]+(?:\.\d{1,2})?)$/);
      if (!m) m = text.match(/^(.+?)\s+\$?([\d,]+(?:\.\d{1,2})?)$/);
      if (m) {
        const desc = m[1].trim().replace(/[$£€¥]/g, '').replace(/\s+\d+\s*$/, '').trim();
        const rate = parseAmount(m[m.length - 1]);
        const qty = m[2] && m.length >= 4 ? parseInt(m[2]) : 1;
        const cleanQty = isNaN(qty) ? 1 : qty;
        const item = { item: desc, description: desc, qty: cleanQty, rate, amount: rate !== null ? rate * cleanQty : null };
        if (datePart) item.date = parseFlexDate(datePart);
        return item;
      }
    }

    const nums = parts.map(p => parseAmount(p.replace(/[$£€¥]/g, '')));
    const numIndices = parts.map((p, i) => nums[i] !== null ? i : -1).filter(i => i >= 0);
    const numCount = numIndices.length;

    if (numCount < 1) {
      // Fallback: skip date-noise prefix, parse remaining as "desc $rate"
      if (parts.length >= 2 && !datePart) {
        const noDateParts = parts.filter(p => {
          const cleaned = p.replace(/^[^0-9]+/, '');
          if (/^\d+[-/]/.test(cleaned) && cleaned.replace(/[^0-9]/g, '').length >= 6) return false;
          if (/^\d{4,}$/.test(p)) return false;
          return true;
        });
        const remaining = noDateParts.join(' ').trim();
        if (remaining.length > 2) {
          const dr = remaining.match(/^(.+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/);
          if (dr) {
            const desc = dr[1].trim();
            const amt = parseAmount(dr[2]);
            if (desc.length > 2 && amt !== null && amt > 0 && amt < 100000) {
              return { item: desc, description: desc, qty: 1, rate: amt, amount: amt, date: null };
            }
          }
        }
      }
      return null;
    }

    const item = { item: parts[0], description: parts[0], qty: 1, rate: null, amount: null, date: datePart ? parseFlexDate(datePart) : null };

    if (numCount >= 3 && parts.length >= 4) {
      const lastNum = nums[parts.length - 1];
      const secondLast = nums[parts.length - 2];
      if (lastNum !== null && secondLast !== null) {
        item.amount = lastNum;
        item.rate = secondLast;
        const qtyPart = parts[parts.length - 3];
        const qtyNum = nums[parts.length - 3];
        if (qtyNum !== null && /^\d+$/.test(qtyPart.trim()) && qtyPart.trim().length <= 4) {
          item.qty = parseInt(qtyPart);
          item.description = parts.slice(1, parts.length - 3).join(' ').trim();
        } else {
          item.description = parts.slice(1, parts.length - 2).join(' ').trim();
        }
        if (!item.description) item.description = item.item;
        return item;
      }
    }

    if (numCount >= 2 && parts.length >= 3) {
      const lastNum = nums[parts.length - 1];
      const secondLast = nums[parts.length - 2];
      if (lastNum !== null && secondLast !== null) {
        item.amount = lastNum;
        item.rate = secondLast;
        item.description = parts.slice(1, parts.length - 2).join(' ').trim();
        if (!item.description) item.description = item.item;
        return item;
      }
    }

    const lastNum = nums[parts.length - 1];
    if (lastNum !== null) {
      item.amount = lastNum;
      item.description = parts.slice(1, parts.length - 1).join(' ').trim() || item.item;
      return item;
    }

    return null;
  }

  _regexLineExtraction(text) {
    const items = [];
    const lines = text.split('\n');
    for (const l of lines) {
      if (/subtotal|total|balance|tax|payment|terms|conditions|thank|make all|payable|charity|tip|service|optional\s*field|add\s+address|add\s+company|add\s+name/i.test(l)) continue;
      // Skip lines that are clearly template placeholders or metadata
      if (/^(gstin|pan|mobile|phone|email|account|ifsc|branch|name|signature)/i.test(l.trim())) continue;
      const pipeParts = l.split(/\s*\|\s*/).filter(Boolean);
      // Check for "DATE | desc [hours] $rate" pattern
      if (pipeParts.length >= 2) {
        const p0 = pipeParts[0].replace(/^[^0-9]+/, '');
        let pipeDate = null;
        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(p0) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(pipeParts[0])) {
          pipeDate = parseFlexDate(p0);
          const rest = pipeParts.slice(1).join(' | ');
          const hrMatch = rest.match(/^(.+?)\s+(\d{1,3})\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/);
          if (hrMatch) {
            const desc = hrMatch[1].trim();
            const qty = parseInt(hrMatch[2]);
            const rate = parseAmount(hrMatch[3]);
            if (desc.length > 1 && qty > 0 && qty <= 10000 && rate !== null) {
              items.push({ item: desc, description: desc, qty, rate, amount: rate * qty, date: pipeDate });
              continue;
            }
          }
          const amtMatch = rest.match(/^(.+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/);
          if (amtMatch) {
            const desc = amtMatch[1].trim();
            const amt = parseAmount(amtMatch[2]);
            if (desc.length > 1 && amt !== null && amt > 0 && amt < 100000 && desc.split(/\s+/).length >= 2) {
              items.push({ item: desc, description: desc, qty: 1, rate: null, amount: amt, date: pipeDate });
              continue;
            }
          }
        }
        const nums = pipeParts.map(p => parseAmount(p.replace(/[$£€¥]/g, '')));
        const numIndices = pipeParts.map((p, i) => nums[i] !== null ? i : -1).filter(i => i >= 0);
        const lastNum = nums[numIndices[numIndices.length - 1]];
        if (numIndices.length >= 1) {
          const secondLast = numIndices.length >= 2 ? nums[numIndices[numIndices.length - 2]] : null;
          const desc = pipeParts.slice(0, numIndices[0]).join(' ').trim();
          if (desc.length > 0) {
            items.push({
              item: desc, description: desc,
              qty: parseInt(pipeParts[0]) || 1,
              rate: secondLast != null && secondLast !== lastNum ? secondLast : null,
              amount: lastNum,
            });
            continue;
          }
          // only one numeric part: qty | description (e.g. "1 | camera"), or desc | amount
          if (numIndices.length === 1 && pipeParts.length === 2) {
            const lastIdx = numIndices[0];
            if (lastIdx === 0) {
              // qty | description
              const qty = parseInt(pipeParts[0]) || 1;
              const descText = pipeParts[1].trim();
              if (descText.length > 0 && !/^\d+$/.test(descText)) {
                items.push({ item: descText, description: descText, qty, rate: null, amount: null });
                continue;
              }
            } else {
              // [date-ish] | desc $amount
              const dateLike = pipeParts.slice(0, lastIdx).filter(p => /^\d+[-/]\d+/.test(p.replace(/^[^0-9]+/, ''))).length > 0;
              const firstPart = pipeParts.slice(0, lastIdx).filter(p => !dateLike || !/^\d+[-/]\d+/.test(p.replace(/^[^0-9]+/, ''))).join(' ').trim();
              const desc = firstPart || pipeParts[0].replace(/^[^A-Za-z]+/, '').trim();
              if (desc.length > 2) {
                items.push({ item: desc, description: desc, qty: 1, rate: lastNum, amount: lastNum, date: pipeDate || null });
                continue;
              }
            }
          }
          // all numeric: qty | rate | amount
          if (numIndices.length >= 2) {
            const descText = pipeParts.slice(1, numIndices[0]).join(' ').trim();
            items.push({
              item: descText || 'Item ' + (items.length + 1), description: descText || 'Item ' + (items.length + 1),
              qty: parseInt(pipeParts[0]) || 1,
              rate: secondLast != null && secondLast !== lastNum ? secondLast : null,
              amount: lastNum,
            });
            continue;
          }
        }
      }
      const m = l.match(/^([A-Za-z\u00C0-\u024F][\w\u00C0-\u024F\s&.-]+?)\s{2,}(\d+)\s{2,}([\d,]+(?:\.\d{2})?)\s{2,}([\d,]+(?:\.\d{2})?)/);
      if (m) {
        items.push({ item: m[1].trim(), description: m[1].trim(), qty: parseInt(m[2]), rate: parseAmount(m[3]), amount: parseAmount(m[4]) });
        continue;
      }
      // Single-space columns: "desc qty rate amount"
      const ss = l.match(/^(.+?)\s+(\d{1,4})\s+(\d[\d,.]*)\s+[$€£¥]?\s*(\d[\d,.]*)$/);
      if (ss && !/subtotal|total|tax|balance|payment/i.test(l)) {
        const desc = ss[1].trim();
        const qty = parseInt(ss[2]);
        const rate = parseAmount(ss[3]);
        const amt = parseAmount(ss[4]);
        if (desc.length > 2 && qty > 0 && qty <= 10000 && amt !== null && amt < 100000000) {
          items.push({ item: desc, description: desc, qty, rate, amount: amt });
          continue;
        }
      }
      const sm = l.match(/^([A-Za-z\u00C0-\u024F][\w\u00C0-\u024F\s&.-]+?)\s+([\d,]+(?:\.\d{2})?)\s*$/);
      if (sm) {
        const amt = parseAmount(sm[2]);
        const desc = sm[1].trim();
        if (desc.length > 2 && amt !== null && amt > 0 && amt < 1000000 && !/^\d+$/.test(desc) && desc.split(/\s+/).length >= 2) {
          items.push({ item: desc, description: desc, qty: 1, rate: null, amount: amt });
        }
      }
    }
    return items;
  }

  _findTableStart(lines, lowerLines) {
    for (let i = 0; i < lines.length; i++) {
      const ll = lowerLines[i];
      for (const pattern of TABLE_HEADER_PATTERNS) {
        if (pattern.regex.test(ll)) return i;
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const ll = lowerLines[i];
      if ((/item|description|product/.test(ll) || /qty|quantity/.test(ll)) &&
          (/amount|price|total|cost|rate/.test(ll))) {
        return i;
      }
    }
    return -1;
  }

  _extractTotals(result, text, lowerText) {
    const sub = text.match(/(?:subtotal[^0-9]*?)\s*\|\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i) || text.match(/(?:subtotal)[\s:.$\u00a0€£¥]*([\d,]+(?:\.\d{1,2})?)/i);
    if (sub) result.subtotal = parseAmount(sub[1]);

    const lines = text.split('\n');
    for (const l of lines) {
      if (/tax|vat|gst|sales\s+tax|hst|mwst|ust/i.test(l) && !/subtotal|total/i.test(l)) {
        const pctMatch = l.match(/\(?\s*([\d.]+)\s*\)?\s*%/);
        if (pctMatch) {
          result.taxRate = parseFloat(pctMatch[1]);
        }
        const amtMatch = l.match(/([\d,]+(?:\.\d{1,2})?)(?!\s*%)/);
        if (amtMatch) {
          const val = parseAmount(amtMatch[1]);
          if (val !== null && val < 100000 && (result.subtotal === null || Math.abs(val - result.subtotal) > 0.01)) {
            result.taxAmount = val;
          }
        }
      }
    }

    const total = text.match(/(?:grand\s+total|total\s+(?:amount|sale)|^total\b)[\s:.=$\u00a0€£¥]*([\d,]+(?:\.\d{1,2})?)/im);
    if (total) result.total = parseAmount(total[1]);
    if (result.total === null) {
      const lines = text.split('\n');
      for (const l of lines) {
        if (/^total[\s:.$]/i.test(l.trim()) && !/subtotal/i.test(l)) {
          const m = l.match(/([\d,]+(?:\.\d{2})?)/);
          if (m) { result.total = parseAmount(m[1]); break; }
        }
      }
    }
    // Fallback: Indian format total (e.g. "1,16,800.00")
    const indianNum = text.match(/(\d{1,2},\d{2},\d{3}\.\d{2})/);
    if (indianNum) {
      const inr = parseAmount(indianNum[1]);
      // Only use if it's larger than the current total (Total Sale typically smaller)
      if (result.total === null || inr > result.total) result.total = inr;
    }

    const balance = text.match(/(?:balance\s*due|amount\s*due|owing)[\s:.$]*([\d,]+(?:\.\d{1,2})?)/i);
    if (balance) result.balanceDue = parseAmount(balance[1]);

    if (result.subtotal !== null && result.total === null && result.items.length > 0) {
      const itemsTotal = result.items.reduce((s, i) => s + (i.amount || 0), 0);
      if (itemsTotal > 0) result.total = itemsTotal;
    }

    if (result.total === null && result.items.length > 0) {
      const itemsTotal = result.items.reduce((s, i) => s + (i.amount || 0), 0);
      if (itemsTotal > 0) result.total = itemsTotal;
    }

    if (result.taxRate === null && result.subtotal !== null && result.taxAmount !== null && result.subtotal > 0) {
      const implied = (result.taxAmount / result.subtotal) * 100;
      if (implied > 0 && implied < 100) result.taxRate = Math.round(implied * 100) / 100;
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'invoiceNumber', weight: 25, test: result.invoiceNumber && result.invoiceNumber.length > 2 },
      { key: 'vendor.name', weight: 10, test: result.vendor.name && result.vendor.name.length > 2 },
      { key: 'customer.name', weight: 10, test: result.customer.name && result.customer.name.length > 2 },
      { key: 'items', weight: 20, test: result.items.length > 0 },
      { key: 'subtotal', weight: 10, test: result.subtotal !== null && result.subtotal > 0 },
      { key: 'total', weight: 15, test: result.total !== null && result.total > 0 },
      { key: 'invoiceDate', weight: 5, test: !!result.invoiceDate },
      { key: 'items_structured', weight: 5, test: result.items.some(i => i.qty > 0 && i.rate !== null) },
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
        'Invoice Number': result.invoiceNumber,
        'Invoice Date': result.invoiceDate,
        'Due Date': result.dueDate,
        'PO Number': result.poNumber,
        'Payment Terms': result.terms,
        'Vendor Name': result.vendor.name,
        'Vendor Email': result.vendor.email,
        'Vendor Phone': result.vendor.phone,
        'Customer Name': result.customer.name,
        'Customer Address': result.customer.address,
        'Subtotal': result.subtotal,
        'Tax Rate': result.taxRate != null ? result.taxRate + '%' : '',
        'Tax Amount': result.taxAmount,
        'Total': result.total,
        'Balance Due': result.balanceDue,
        'Item Count': result.items.length,
      },
      lineItems: result.items.map((item, i) => ({
        '#': i + 1,
        'Item': item.item || item.description,
        'Description': item.description,
        'Qty': item.qty,
        'Rate': item.rate,
        'Amount': item.amount,
      })),
      tables: result.detectedTables,
    };
  }
}

module.exports = { InvoiceParser };