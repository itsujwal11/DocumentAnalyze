function normalize(docType, fileName, confidence, rawText, entities, fields, records) {
  const recs = records || [];
  const normRecs = recs.map((r, i) => {
    const base = {
      id: i + 1,
      date: r.date || '',
      description: r.description || '',
      type: r.type || '',
      debit: r.debit || 0,
      credit: r.credit || 0,
      balance: r.balance || 0,
    };
    if (r.qty !== undefined && r.qty !== null) base.qty = r.qty;
    if (r.rate !== undefined && r.rate !== null) base.rate = r.rate;
    if (r.amount !== undefined && r.amount !== null) base.amount = r.amount;
    return base;
  });

  const totalDebit = recs.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = recs.reduce((s, r) => s + (r.credit || 0), 0);
  const lastBal = recs.filter(r => r.balance != null).length > 0
    ? recs.filter(r => r.balance != null).pop().balance
    : null;

  return {
    documentType: docType,
    fileName,
    extractionConfidence: confidence,
    rawText,
    entities: entities || [],
    fields: fields || {},
    records: normRecs,
    summary: {
      totalDebit,
      totalCredit,
      netBalance: lastBal != null ? lastBal : totalCredit - totalDebit,
      recordCount: recs.length,
    },
  };
}

module.exports = { normalize };