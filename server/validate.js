function validateParserResult(parser, docType) {
  const confidence = parser.getConfidence ? parser.getConfidence() : 0;
  const needsReview = confidence < 70;

  const result = {
    documentType: docType,
    extractionConfidence: confidence,
    needsReview,
    status: needsReview ? 'needs_review' : 'verified',
    fieldConfidence: parser.fieldConfidence || {},
  };

  return result;
}

function validateInvoiceResult(parserResult) {
  return {
    invoiceNumber: parserResult.invoiceNumber ? { value: parserResult.invoiceNumber, confidence: 100 } : { value: '', confidence: 0 },
    invoiceDate: parserResult.invoiceDate ? { value: parserResult.invoiceDate, confidence: 90 } : { value: '', confidence: 0 },
    dueDate: parserResult.dueDate ? { value: parserResult.dueDate, confidence: 80 } : { value: '', confidence: 0 },
    total: parserResult.total ? { value: parserResult.total, confidence: 95 } : { value: null, confidence: 0 },
    itemCount: parserResult.items.length > 0 ? { value: parserResult.items.length, confidence: 90 } : { value: 0, confidence: 0 },
  };
}

function validateBankStatementResult(parserResult) {
  return {
    accountNumber: parserResult.accountNumber ? { value: parserResult.accountNumber, confidence: 100 } : { value: '', confidence: 0 },
    transactionCount: parserResult.transactions.length > 0 ? { value: parserResult.transactions.length, confidence: 90 } : { value: 0, confidence: 0 },
  };
}

function validateReceiptResult(parserResult) {
  return {
    merchant: parserResult.merchant ? { value: parserResult.merchant, confidence: 85 } : { value: '', confidence: 0 },
    total: parserResult.total ? { value: parserResult.total, confidence: 95 } : { value: null, confidence: 0 },
    itemCount: parserResult.items.length > 0 ? { value: parserResult.items.length, confidence: 85 } : { value: 0, confidence: 0 },
  };
}

function validateUtilityResult(parserResult) {
  return {
    accountNumber: parserResult.accountNumber ? { value: parserResult.accountNumber, confidence: 100 } : { value: '', confidence: 0 },
    customerName: parserResult.customerName ? { value: parserResult.customerName, confidence: 85 } : { value: '', confidence: 0 },
    totalDue: parserResult.totalAmountDue ? { value: parserResult.totalAmountDue, confidence: 90 } : { value: null, confidence: 0 },
  };
}

function validatePayslipResult(parserResult) {
  return {
    employeeName: parserResult.employeeName ? { value: parserResult.employeeName, confidence: 90 } : { value: '', confidence: 0 },
    grossPay: parserResult.grossPay ? { value: parserResult.grossPay, confidence: 85 } : { value: null, confidence: 0 },
    netPay: parserResult.netPay ? { value: parserResult.netPay, confidence: 90 } : { value: null, confidence: 0 },
  };
}

function validatePurchaseOrderResult(parserResult) {
  return {
    poNumber: parserResult.poNumber ? { value: parserResult.poNumber, confidence: 100 } : { value: '', confidence: 0 },
    vendor: parserResult.vendor?.name ? { value: parserResult.vendor.name, confidence: 85 } : { value: '', confidence: 0 },
    total: parserResult.total ? { value: parserResult.total, confidence: 85 } : { value: null, confidence: 0 },
  };
}

function validateContractResult(parserResult) {
  return {
    title: parserResult.contractTitle ? { value: parserResult.contractTitle, confidence: 80 } : { value: '', confidence: 0 },
    parties: parserResult.parties.length > 0 ? { value: parserResult.parties.join('; '), confidence: 85 } : { value: '', confidence: 0 },
    effectiveDate: parserResult.effectiveDate ? { value: parserResult.effectiveDate, confidence: 85 } : { value: '', confidence: 0 },
  };
}

function validateTaxDocumentResult(parserResult) {
  return {
    formType: parserResult.taxFormType ? { value: parserResult.taxFormType, confidence: 95 } : { value: '', confidence: 0 },
    taxYear: parserResult.taxYear ? { value: parserResult.taxYear, confidence: 90 } : { value: '', confidence: 0 },
    taxpayerName: parserResult.taxpayerName ? { value: parserResult.taxpayerName, confidence: 85 } : { value: '', confidence: 0 },
  };
}

function validateShippingResult(parserResult) {
  return {
    carrier: parserResult.carrier ? { value: parserResult.carrier, confidence: 85 } : { value: '', confidence: 0 },
    trackingNumber: parserResult.trackingNumber ? { value: parserResult.trackingNumber, confidence: 95 } : { value: '', confidence: 0 },
  };
}

module.exports = {
  validateParserResult,
  validateInvoiceResult, validateBankStatementResult, validateReceiptResult,
  validateUtilityResult, validatePayslipResult, validatePurchaseOrderResult,
  validateContractResult, validateTaxDocumentResult, validateShippingResult,
};