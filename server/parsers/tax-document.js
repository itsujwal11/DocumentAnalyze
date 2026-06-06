const { BaseParser } = require('./base');
const { parseAmount, parseFlexDate } = require('../config');

class TaxDocumentParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    const result = {
      taxFormType: '',
      taxYear: '',
      taxpayerName: '',
      taxpayerId: '',
      employerName: '',
      employerId: '',
      wages: null,
      federalWithholding: null,
      socialSecurityWages: null,
      socialSecurityTax: null,
      medicareWages: null,
      medicareTax: null,
      stateWages: null,
      stateTax: null,
      localWages: null,
      localTax: null,
      adjustedGrossIncome: null,
      totalIncome: null,
      totalDeductions: null,
      taxableIncome: null,
      totalTax: null,
      refundOrOwed: null,
      detectedTables: [],
      filingStatus: '',
    };

    this._extractGeneral(result, text, lines, lowerText);
    this._extractFinancial(result, text, lowerText);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);

    return result;
  }

  _extractGeneral(result, text, lines, lowerText) {
    const formType = text.match(/(?:form|irs)\s*(W-2|W2|1099|1098|1040|1120|1065|990|941|940)[-\s]?/i);
    if (formType) result.taxFormType = formType[1].toUpperCase();

    const taxYear = text.match(/(?:tax\s*year|for\s*year|calendar\s*year)[:\s]*(\d{4})/i);
    if (taxYear) result.taxYear = taxYear[1];

    if (!result.taxYear) {
      const year = text.match(/\b(20\d{2})\b/);
      if (year) result.taxYear = year[1];
    }

    const taxpayer = text.match(/(?:taxpayer\s*name|employee\s*name|name)[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (taxpayer) result.taxpayerName = taxpayer[1].trim();

    const tpid = text.match(/(?:taxpayer\s*(?:id|identification|ssn|ein)|employee\s*(?:id|ssn))[:\s]*([A-Z0-9-]+)/i);
    if (tpid) result.taxpayerId = tpid[1].trim();

    const employer = text.match(/(?:employer\s*name|employer)[:\s]*([A-Za-z0-9\s.]+?)(?:\n|$)/i);
    if (employer) result.employerName = employer[1].trim();

    const empId = text.match(/(?:employer\s*(?:id|identification|ein))[:\s]*([A-Z0-9-]+)/i);
    if (empId) result.employerId = empId[1].trim();

    const status = text.match(/(?:filing\s*status|status)[:\s]*([A-Za-z\s]+?)(?:\n|$)/i);
    if (status) result.filingStatus = status[1].trim();
  }

  _extractFinancial(result, text, lowerText) {
    const wageRe = /(?:wages|wages,?\s*tips|compensation|income)[\s:.$]*([\d,]+(?:\.\d{2})?)/i;
    const wageM = text.match(wageRe);
    if (wageM) result.wages = parseAmount(wageM[1]);

    const fedRe = /(?:federal\s*income\s*tax|federal\s*withholding)[\s:.$]*([\d,]+(?:\.\d{2})?)/i;
    const fedM = text.match(fedRe);
    if (fedM) result.federalWithholding = parseAmount(fedM[1]);

    const ssWage = text.match(/(?:social\s*security\s*wages|social\s*security)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (ssWage) result.socialSecurityWages = parseAmount(ssWage[1]);

    const ssTax = text.match(/(?:social\s*security\s*tax)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (ssTax) result.socialSecurityTax = parseAmount(ssTax[1]);

    const mcWage = text.match(/(?:medicare\s*wages|medicare)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (mcWage) result.medicareWages = parseAmount(mcWage[1]);

    const mcTax = text.match(/(?:medicare\s*tax)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (mcTax) result.medicareTax = parseAmount(mcTax[1]);

    const stWage = text.match(/(?:state\s*wages|state)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (stWage) result.stateWages = parseAmount(stWage[1]);

    const stTax = text.match(/(?:state\s*income\s*tax|state\s*tax)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (stTax) result.stateTax = parseAmount(stTax[1]);

    const loWage = text.match(/(?:local\s*wages|local)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (loWage) result.localWages = parseAmount(loWage[1]);

    const loTax = text.match(/(?:local\s*tax)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (loTax) result.localTax = parseAmount(loTax[1]);

    const agi = text.match(/(?:adjusted\s*gross\s*income|agi)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (agi) result.adjustedGrossIncome = parseAmount(agi[1]);

    const totalIncome = text.match(/(?:total\s*income)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (totalIncome) result.totalIncome = parseAmount(totalIncome[1]);

    const ded = text.match(/(?:total\s*deductions|deductions)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (ded) result.totalDeductions = parseAmount(ded[1]);

    const taxable = text.match(/(?:taxable\s*income)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (taxable) result.taxableIncome = parseAmount(taxable[1]);

    const totalTax = text.match(/(?:total\s*tax|tax\s*amount)[\s:.$]*([\d,]+(?:\.\d{2})?)/i);
    if (totalTax) result.totalTax = parseAmount(totalTax[1]);

    const refund = text.match(/(?:refund|amount\s*you\s*owe|balance\s*due)[\s:.$]*(-?[\d,]+(?:\.\d{2})?)/i);
    if (refund) result.refundOrOwed = parseAmount(refund[1]);
  }

  _getValidationChecks(result) {
    return [
      { key: 'taxFormType', weight: 20, test: !!result.taxFormType },
      { key: 'taxpayerName', weight: 20, test: result.taxpayerName && result.taxpayerName.length > 2 },
      { key: 'taxYear', weight: 20, test: !!result.taxYear },
      { key: 'wages', weight: 15, test: result.wages !== null },
      { key: 'federalWithholding', weight: 15, test: result.federalWithholding !== null },
      { key: 'employerName', weight: 10, test: result.employerName && result.employerName.length > 2 },
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
        'Tax Form': result.taxFormType,
        'Tax Year': result.taxYear,
        'Filing Status': result.filingStatus,
        'Taxpayer Name': result.taxpayerName,
        'Taxpayer ID': result.taxpayerId,
        'Employer Name': result.employerName,
        'Employer ID': result.employerId,
        'Wages': result.wages,
        'Federal Withholding': result.federalWithholding,
        'Social Security Wages': result.socialSecurityWages,
        'Social Security Tax': result.socialSecurityTax,
        'Medicare Wages': result.medicareWages,
        'Medicare Tax': result.medicareTax,
        'State Wages': result.stateWages,
        'State Tax': result.stateTax,
        'Local Wages': result.localWages,
        'Local Tax': result.localTax,
        'Adjusted Gross Income': result.adjustedGrossIncome,
        'Total Income': result.totalIncome,
        'Total Deductions': result.totalDeductions,
        'Taxable Income': result.taxableIncome,
        'Total Tax': result.totalTax,
        'Refund / Amount Owed': result.refundOrOwed,
      },
      tables: result.detectedTables,
    };
  }
}

module.exports = { TaxDocumentParser };