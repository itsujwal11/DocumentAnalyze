const { BaseParser } = require('./base');
const { parseAmount, parseFlexDate } = require('../config');

class ShippingDocumentParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      carrier: '',
      trackingNumber: '',
      shipper: { name: '', address: '' },
      consignee: { name: '', address: '' },
      origin: '',
      destination: '',
      shipDate: '',
      deliveryDate: '',
      weight: null,
      weightUnit: '',
      packages: null,
      declaredValue: null,
      freightCharge: null,
      serviceType: '',
      detectedTables: [],
      referenceNumber: '',
    };

    this._extractHeader(result, text, lines);
    this._extractFinancial(result, text, lowerText);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractHeader(result, text, lines) {
    const carrier = text.match(/(?:carrier|shipping\s*line|shipped\s*via)[:\s]*([A-Za-z0-9\s.]+?)(?:\n|$)/i);
    if (carrier) result.carrier = carrier[1].trim();

    const tracking = text.match(/(?:tracking\s*(?:number|no|#)|pro\s*(?:number|no|#)|reference\s*(?:number|no|#))[:\s]*([A-Z0-9][-A-Z0-9]+)/i);
    if (tracking) result.trackingNumber = tracking[1].trim();

    const refNum = text.match(/(?:reference|ref)\s*(?:number|no|#)?[:\s]*([A-Z0-9][-A-Z0-9]+)/i);
    if (refNum && !result.trackingNumber) result.referenceNumber = refNum[1].trim();
    else if (refNum) result.referenceNumber = refNum[1].trim();

    const origin = text.match(/(?:origin|from)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\n|$)/i);
    if (origin) result.origin = origin[1].trim();

    const dest = text.match(/(?:destination|to|deliver\s*to)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\n|$)/i);
    if (dest) result.destination = dest[1].trim();

    const shipDate = text.match(/(?:ship\s*date|shipped\s*on|date\s*of\s*shipment)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (shipDate) result.shipDate = parseFlexDate(shipDate[1].trim());

    const delivDate = text.match(/(?:delivery\s*date|estimated\s*delivery|delivered\s*on)[:\s]*([A-Za-z0-9,\s-]+?)(?:\n|$)/i);
    if (delivDate) result.deliveryDate = parseFlexDate(delivDate[1].trim());

    const weight = text.match(/(?:weight|net\s*weight|gross\s*weight)[:\s]*([\d,]+(?:\.\d+)?)\s*(lbs|lb|lbs|kg|kgs|g|oz|t)/i);
    if (weight) { result.weight = parseFloat(weight[1].replace(/,/g, '')); result.weightUnit = weight[2].toLowerCase(); }

    const packages = text.match(/(?:packages|pieces|pcs|cartons|containers)[:\s]*(\d+)/i);
    if (packages) result.packages = parseInt(packages[1]);

    const service = text.match(/(?:service\s*type|service)[:\s]*([A-Za-z0-9\s]+?)(?:\n|$)/i);
    if (service) result.serviceType = service[1].trim();

    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const l = lines[i];
      if (l && l.length > 2 && l.length < 60 && !/^\d/.test(l) &&
          !/ship|track|pro|date|page|weight/i.test(l)) {
        const alphaRatio = (l.match(/[A-Za-z\s]/g) || []).length / l.length;
        if (alphaRatio > 0.6) { result.shipper.name = l; break; }
      }
    }
    if (!result.shipper.name) result.shipper.name = lines[0] || '';

    const consigneeMatch = text.match(/(?:consignee|ship\s*to|deliver\s*to)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\n|$)/i);
    if (consigneeMatch) result.consignee.name = consigneeMatch[1].trim();
  }

  _extractFinancial(result, text, lowerText) {
    const declValue = text.match(/(?:declared\s*value|value\s*for\s*carriage)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (declValue) result.declaredValue = parseAmount(declValue[1]);

    const freight = text.match(/(?:freight\s*charge|freight|shipping\s*cost|transport\s*charge)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (freight) result.freightCharge = parseAmount(freight[1]);
  }

  _getValidationChecks(result) {
    return [
      { key: 'trackingNumber', weight: 25, test: result.trackingNumber && result.trackingNumber.length > 3 },
      { key: 'carrier', weight: 20, test: result.carrier && result.carrier.length > 2 },
      { key: 'origin', weight: 15, test: !!result.origin },
      { key: 'destination', weight: 15, test: !!result.destination },
      { key: 'weight', weight: 10, test: result.weight !== null },
      { key: 'shipDate', weight: 10, test: !!result.shipDate },
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
        'Carrier': result.carrier,
        'Tracking Number': result.trackingNumber,
        'Reference Number': result.referenceNumber,
        'Shipper': result.shipper.name,
        'Consignee': result.consignee.name,
        'Origin': result.origin,
        'Destination': result.destination,
        'Ship Date': result.shipDate,
        'Delivery Date': result.deliveryDate,
        'Weight': result.weight != null ? `${result.weight} ${result.weightUnit}` : '',
        'Packages': result.packages,
        'Service Type': result.serviceType,
        'Declared Value': result.declaredValue,
        'Freight Charge': result.freightCharge,
      },
      tables: result.detectedTables,
    };
  }
}

module.exports = { ShippingDocumentParser };