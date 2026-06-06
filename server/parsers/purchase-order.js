const { BaseParser } = require('./base');
const { STATE_ABBREVS, parseAmount, parseFlexDate } = require('../config');

class PurchaseOrderParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      poNumber: '',
      orderDate: '',
      deliveryDate: '',
      vendor: { name: '', address: '' },
      shipTo: { name: '', address: '' },
      billTo: { name: '', address: '' },
      items: [],
      subtotal: null,
      tax: null,
      shipping: null,
      total: null,
      requester: '',
      buyer: '',
      paymentTerms: '',
      deliveryMethod: '',
      detectedTables: [],
    };

    this._extractHeader(result, text, lines, lowerText);
    this._extractParties(result, text, lines);
    this._extractItems(result, text, lines, lowerText);
    this._extractTotals(result, text, lowerText);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractHeader(result, text, lines, lowerText) {
    const poNum = text.match(/(?:purchase\s*order|po)\s*(?:number|no|#)?[:\s]*([A-Z0-9][-A-Z0-9/]+)/i);
    if (poNum) result.poNumber = poNum[1].trim();

    const orderDate = text.match(/(?:order\s*date|date\s*of\s*order|po\s*date)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (orderDate) result.orderDate = parseFlexDate(orderDate[1].trim());

    const delivery = text.match(/(?:delivery\s*date|ship\s*date|requested\s*delivery)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (delivery) result.deliveryDate = parseFlexDate(delivery[1].trim());

    const requester = text.match(/(?:requisitioner|requested\s*by|requester)[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (requester) result.requester = requester[1].trim();

    const buyer = text.match(/(?:buyer|purchased\s*by|prepared\s*by)[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (buyer) result.buyer = buyer[1].trim();

    const terms = text.match(/(?:payment\s*terms|terms)[:\s]*([A-Za-z0-9\s,-]{3,60})/i);
    if (terms) result.paymentTerms = terms[1].trim();

    const deliveryMethod = text.match(/(?:delivery\s*method|ship\s*via|freight)[:\s]*([A-Za-z0-9\s]+?)(?:\n|$)/i);
    if (deliveryMethod) result.deliveryMethod = deliveryMethod[1].trim();
  }

  _extractParties(result, text, lines) {
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const l = lines[i];
      if (l && !/purchase|order|po|date|page|total|tax/i.test(l) && !/^\d/.test(l) && l.length > 2 && l.length < 60) {
        const alphaRatio = (l.match(/[A-Za-z\s]/g) || []).length / l.length;
        if (alphaRatio > 0.6) { result.vendor.name = l; break; }
      }
    }
    if (!result.vendor.name) result.vendor.name = lines[0] || '';

    const shipBlock = this._extractBlock('ship to', lines, 5);
    if (shipBlock) result.shipTo = { name: shipBlock.split(',')[0].trim(), address: shipBlock };

    const billBlock = this._extractBlock('bill to', lines, 5);
    if (billBlock) result.billTo = { name: billBlock.split(',')[0].trim(), address: billBlock };
  }

  _extractBlock(label, lines, maxExtra) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(label.toLowerCase())) {
        const parts = [
          lines[i].replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/^[:\s]+/, ''),
        ];
        for (let j = i + 1; j < Math.min(i + 1 + maxExtra, lines.length); j++) {
          const l = lines[j];
          if (!l) break;
          if (/^(purchase|order|po|date|page|total|tax|subtotal|amount|item|qty|quantity|unit|price|ship|delivery|payment|terms|buyer|requisition|reference|ref|authorization|auth)[\s:]/i.test(l)) break;
          parts.push(l);
        }
        return parts.filter(Boolean).join(', ').trim();
      }
    }
    return '';
  }

  _extractItems(result, text, lines, lowerText) {
    let inTable = false;
    const tableRows = [];
    for (let i = 0; i < lines.length; i++) {
      const ll = lines[i].toLowerCase();
      if (/item|product|description|qty|quantity/i.test(ll) && /price|total|amount|cost/i.test(ll)) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;
      if (/total|subtotal|tax|shipping|thank|signature|authorized/i.test(ll)) break;
      const l = lines[i];
      tableRows.push(l);
    }

    for (const row of tableRows) {
      const parts = row.split(/\s{2,}|\t/).filter(Boolean);
      if (parts.length < 2) continue;
      const nums = parts.map(p => parseAmount(p));
      const lastNum = nums[nums.length - 1];
      if (lastNum === null) continue;

      if (parts.length >= 4) {
        const qty = parts[parts.length - 3];
        const rateNum = nums[nums.length - 2];
        const qtyNum = parseInt(qty);
        result.items.push({
          item: parts[0],
          description: parts.slice(1, parts.length - 3).join(' ') || parts[0],
          qty: !isNaN(qtyNum) ? qtyNum : 1,
          unitPrice: rateNum !== null ? rateNum : null,
          total: lastNum,
        });
      } else {
        result.items.push({
          item: parts.slice(0, -1).join(' '),
          description: parts.slice(0, -1).join(' '),
          qty: 1, unitPrice: null, total: lastNum,
        });
      }
    }
  }

  _extractTotals(result, text, lowerText) {
    const sub = text.match(/(?:subtotal)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (sub) result.subtotal = parseAmount(sub[1]);

    const tax = text.match(/(?:tax|vat|gst)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (tax) result.tax = parseAmount(tax[1]);

    const ship = text.match(/(?:shipping|freight)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (ship) result.shipping = parseAmount(ship[1]);

    const total = text.match(/(?:total|grand\s+total)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (total) result.total = parseAmount(total[1]);

    if (result.total === null && result.items.length > 0) {
      result.total = result.items.reduce((s, i) => s + (i.total || 0), 0);
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'poNumber', weight: 25, test: result.poNumber && result.poNumber.length > 2 },
      { key: 'vendor.name', weight: 15, test: result.vendor.name && result.vendor.name.length > 2 },
      { key: 'items', weight: 20, test: result.items.length > 0 },
      { key: 'orderDate', weight: 10, test: !!result.orderDate },
      { key: 'total', weight: 15, test: result.total !== null },
      { key: 'billTo', weight: 10, test: result.billTo.name && result.billTo.name.length > 2 },
      { key: 'shipTo', weight: 5, test: result.shipTo.name && result.shipTo.name.length > 2 },
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
        'PO Number': result.poNumber,
        'Order Date': result.orderDate,
        'Delivery Date': result.deliveryDate,
        'Vendor Name': result.vendor.name,
        'Requester': result.requester,
        'Buyer': result.buyer,
        'Payment Terms': result.paymentTerms,
        'Delivery Method': result.deliveryMethod,
        'Ship To': result.shipTo.name,
        'Ship To Address': result.shipTo.address,
        'Bill To': result.billTo.name,
        'Bill To Address': result.billTo.address,
        'Subtotal': result.subtotal,
        'Tax': result.tax,
        'Shipping': result.shipping,
        'Total': result.total,
        'Item Count': result.items.length,
      },
      lineItems: result.items.map((item, i) => ({
        '#': i + 1,
        'Item': item.item,
        'Description': item.description,
        'Qty': item.qty,
        'Unit Price': item.unitPrice,
        'Total': item.total,
      })),
      tables: result.detectedTables,
    };
  }
}

module.exports = { PurchaseOrderParser };