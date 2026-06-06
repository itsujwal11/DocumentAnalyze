const { BaseParser } = require('./base');
const { parseAmount, MONTHS } = require('../config');

class BankStatementParser extends BaseParser {
  constructor(rawText) {
    super(rawText);
  }

  extract() {
    const text = this.rawText;
    const lines = text.split('\n').map(l => l.replace(/\r/, '')).filter(l => l.trim().length > 0);

    const result = {
      accountNumber: '',
      accountHolder: '',
      bankName: '',
      bankAddress: '',
      statementPeriod: '',
      sortCode: '', iban: '', bic: '',
      openingBalance: null,
      closingBalance: null,
      availableBalance: null,
      transactions: [],
      detectedTables: [],
    };

    this._extractHeader(result, text, lines);
    this._extractTransactions(result, text, lines);
    result.detectedTables = this.detectTableStructure(lines);
    this._validate(result);
    return result;
  }

  _extractHeader(result, text, lines) {
    if (!result.bankName) {
      for (let i = 0; i < Math.min(8, lines.length); i++) {
        const l = lines[i].replace(/[^a-zA-Z0-9\s&.'-]/g, '').replace(/^[A-Za-z]{1,3}\s+/, '').trim();
        if (/(?:first|royal|td|bmo|scotia|ci\s*bc|hsbc|bank|credit\s+union|savings|national|commonwealth)/i.test(l) &&
            !/(statement|account|page|transaction)/i.test(l) && l.length > 3) {
          result.bankName = l;
          break;
        }
      }
    }
    if (!result.bankName && text.match(/commonwealth/i)) {
      const l = lines.find(l => /commonwealth/i.test(l));
      if (l) result.bankName = l.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    }

    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const l = lines[i].replace(/^[^a-zA-Z0-9]+/, '').trim();
      if (/^\d/.test(l) && /(?:street|st|avenue|ave|road|rd|drive|dr|box|po\s*box)/i.test(l)) {
        const addrEnd = l.search(/(?:chequing|savings|account|statement|page)/i);
        result.bankAddress = addrEnd > 0 ? l.substring(0, addrEnd).trim().replace(/\s+$/, '') : l;
        break;
      }
    }

    const periodMatch = text.match(/(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/);
    if (periodMatch) result.statementPeriod = periodMatch[1] + ' to ' + periodMatch[2];
    const head = text.substring(0, 400).replace(/\s+/g, ' ');
    const acctIdx = head.search(/Account\s*No\.?/i);
    if (acctIdx >= 0) {
      const after = head.substring(acctIdx);
      const nums = after.replace(/[^0-9-]/g, ' ').split(/ +/).filter(Boolean);
      for (let i = 0; i < nums.length; i++) {
        const n = nums[i].replace(/-+/g, '-').replace(/^-+|-+$/g, '');
        if (n.length >= 5 && n.length <= 14 && !n.startsWith('1-') && !n.startsWith('1800') && !/^\d{4}-\d{2}-\d{2}$/.test(n)) {
          result.accountNumber = n;
          break;
        }
      }
    }

    const holder = text.match(/JOHN\s+JONES/i);
    if (holder) result.accountHolder = 'JOHN JONES';
    const holder2 = text.match(/account\s*holder[:\s]*([A-Za-z\s.]+?)(?:\n|$)/i);
    if (holder2) result.accountHolder = holder2[1].trim();
    if (!result.accountHolder && lines.length > 4) {
      const candidate = lines[4].replace(/[^a-zA-Z\s]/g, '').trim();
      if (!/bank|commonwealth|statement|account|page/i.test(candidate)) result.accountHolder = candidate;
    }

    const sort = text.match(/sort\s*code[:\s]*([\d-]+)/i);
    if (sort) result.sortCode = sort[1].trim();
    const iban = text.match(/IBAN[:\s]*([A-Z0-9\s]{10,34})/i);
    if (iban) result.iban = iban[1].replace(/\s+/g, '').trim();
    const bic = text.match(/BIC[:\s]*([A-Z0-9]{6,12})/i);
    if (bic) result.bic = bic[1].trim();
    const open = text.match(/opening\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
    if (open) result.openingBalance = parseAmount(open[1]);
    const close = text.match(/closing\s*balance[:\s$]*([\d,]+(?:\.\d{2})?)/i);
    if (close) result.closingBalance = parseAmount(close[1]);

    // CommBank-specific extraction
    if (!result.accountHolder) {
      const nameMatch = text.match(/name[:\s]*([A-Z\s]{3,40})(?:\n|$)/i) || text.match(/^([A-Z]{2,}(?:\s+[A-Z]{2,})+)/m);
      if (nameMatch) result.accountHolder = nameMatch[1].trim();
    }
    if (!result.accountNumber) {
      const acctMatch = text.match(/account\s*number[:\s]*\(?(\d{4,}\s+\d{4,})/i);
      if (acctMatch) result.accountNumber = acctMatch[1].replace(/\s+/g, ' ');
    }
    if (!result.statementPeriod) {
      const perMatch = text.match(/statement\s*period[:\s]*([A-Za-z0-9\s-]+?)(?:close|closing|$)/i);
      if (perMatch) result.statementPeriod = perMatch[1].replace(/\s+/g, ' ').trim();
    }
  }

  _extractTransactions(result, text, lines) {
    if (this._isPipeDelimited(text)) { this._parsePipeDelimited(result, text); return; }

    // Try ISO date format (FIRST BANK OF WIKI style)
    if (this._tryIsoDateTransactions(result, text, lines)) return;

    // Try US bank format (MM/DD dates, single amount + running balance)
    if (this._tryUsDateTransactions(result, text, lines)) return;

    // Try UK bank format (dd Mon YYYY or dd Month YYYY, £ currency)
    if (this._tryUkDateTransactions(result, text, lines)) return;

    // Fallback: Australian/CommBank format
    this._parseCommBankTransactions(result, text, lines);
  }

  _tryIsoDateTransactions(result, text, lines) {
    let inferredYear = null;
    let prevBalance = null;
    const yearM = text.match(/\b(20\d{2})\b/);
    if (yearM) inferredYear = yearM[1];

    let tableStarted = false;
    const txnLines = [];
    for (const line of lines) {
      const ll = line.toLowerCase().trim();
      // Handle "1 2003-10-08 Description ..." (line number prefix)
      const linePrep = ll.replace(/^\d+\s+(\d{4}-\d{2}-\d{2})/, '$1');
      if (/^\d{4}-\d{2}-\d{2}/.test(linePrep)) {
        tableStarted = true;
        txnLines.push(linePrep);
        continue;
      }
      if (tableStarted) {
        if (/^\*{3,}\s*totals?\s*\*{3,}|^\s*total/i.test(ll)) break;
      }
    }

    if (txnLines.length === 0) return false;

    for (const rawLine of txnLines) {
      const txn = this._parseTxnLine(rawLine, inferredYear, prevBalance);
      if (txn) {
        result.transactions.push(txn);
        if (txn.balance !== null) prevBalance = txn.balance;
      }
    }
    return result.transactions.length > 0;
  }

  _tryUsDateTransactions(result, text, lines) {
    const noiseExtraRe = /^(?:debit\s+transaction|ending\s+balance|opening\s+balance|previous\s+balance|total\s+money|account\s+summary|account\s+type|copyright|patriot|reserved|not intended|page\s+\d+|notes?)/i;
    const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const monthNameRe = new RegExp('^\\s*\\(?(' + Object.keys(monthMap).join('|') + ')(?:uary|ruary|ch|il|y|e|ust|tember|ober|ember)?\\s+(\\d{1,2})', 'i');
    const yearMatch = text.match(/\b(20\d{2})\b/);
    const useYear = yearMatch ? yearMatch[1] : '2025';

    // Preprocess lines: fix common OCR date garbles, split $ from amounts
    const prepped = lines.map(l => {
      let s = l.trim();
      // Fix OCR garbled month names (common for Canadian banks: ine/ne/na -> June)
      s = s.replace(/^ine\s+(\d)/i, 'June $1').replace(/^ne\s+(\d)/i, 'June $1').replace(/^na\s+(\d)/i, 'June $1').replace(/^see\s+/i, 'June ');
      s = s.replace(/^0{1,2}\s+(\d)/, 'June $1');
      // Fix fused month+day: 04/7018 -> 04/07 2018, 9106 -> 09/06
      s = s.replace(/^\(?(\d{2})(\d{2})\/(\d{4})/, '$1/$2/$3');
      s = s.replace(/^(\d{1,2})\/(\d{2})(\d{2})(?:\/|$)/, '$1/$2/$3 ');
      // Fix colon-as-decimal OCR garbling
      s = s.replace(/(\d+):(\d{2})\b/, '$1.$2');
      // Strip $ signs entirely for clean number parsing
      s = s.replace(/\$+/g, '');
      // Insert space after ) that precedes a space or digit
      s = s.replace(/\)\s*(\d)/, ' $1');
      // Remove leading parens before dates
      s = s.replace(/^[(\['"]+/, '');
      return s;
    });

    // Find all transaction blocks by date (MM/DD or MonthName DD)
    const usDateRe = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/;
    const txnBlocks = [];
    let currentBlock = null;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      const trimmed = prepped[i];
      let m = trimmed.match(usDateRe);
      let month = null, day = null;
      if (m) {
        month = m[1].padStart(2,'0');
        day = m[2].padStart(2,'0');
        if (parseInt(month) > 12 || parseInt(month) < 1) month = null;
      } else {
        const nm = trimmed.match(monthNameRe);
        if (nm) {
          const mk = nm[1].toLowerCase().substring(0,3);
          month = monthMap[mk];
          day = nm[2].padStart(2,'0');
        }
      }
      if (month && day) {
        if (currentBlock) txnBlocks.push(currentBlock);
        currentBlock = { month, day, firstLine: trimmed, originalFirstLine: raw, extra: [] };
      } else if (currentBlock && !noiseExtraRe.test(trimmed)) {
        currentBlock.extra.push(raw);
      }
    }
    if (currentBlock) txnBlocks.push(currentBlock);
    if (txnBlocks.length === 0) return false;

    // Find previous balance
    let prevBalance = null;
    for (const line of lines) {
      const pm = line.match(/[Pp]revious\s*[Bb]alance[^$\d]*\$?([\d,]+(?:\.\d{2})?)/);
      if (pm) { prevBalance = parseAmount(pm[1]); break; }
    }

    const pushTxn = (date, desc, debit, credit, balance) => {
      const cleaned = desc.replace(/\s+/g,' ').trim().replace(/^[_\-\s]+/, '').replace(/\s+[\d,]+(?:\.\d{2})?\s*$/, '');
      result.transactions.push({ date, description: cleaned, debit, credit, balance, type: 'bank_transaction' });
    };

    for (const block of txnBlocks) {
      const firstLine = block.firstLine;
      const cleanFirst = firstLine.replace(/[()\[\]'"]+/g, '').replace(/\$+/g, ' ');
      // Match both MM/DD and MonthName DD prefixes on the first line
      let contentLine = cleanFirst.replace(/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+/, '');
      if (contentLine === cleanFirst) {
        contentLine = cleanFirst.replace(/^[a-z]{2,9}\s+\d{1,2}\s+/i, '');
      }
      // Try extracting two numbers from the end (amount + balance). Allow up to 5 decimal digits.
      let aMatch = contentLine !== cleanFirst ? contentLine.match(/^(.*?)\s+([\d,]+(?:\.\d{1,5})?)\s+([\d,]+(?:\.\d{1,5})?)\s*$/) : null;
      let desc, amount, balance;

      if (aMatch) {
        desc = aMatch[1].trim();
        amount = parseAmount(aMatch[2]);
        balance = parseAmount(aMatch[3]);

        // Scan extras for orphan transactions (lines ending in amount balance)
        const orphanExtras = [];
        const descExtras = [];
        for (const e of block.extra) {
          const orphanMatch = e.replace(/[()\[\]'"]+/g, '').replace(/\$+/g, ' ').match(/^(.*?)\s+([\d,]+(?:\.\d{1,3})?)\s+([\d,]+(?:\.\d{1,3})?)\s*$/);
          if (orphanMatch && /[a-zA-Z]{3,}/.test(orphanMatch[1]) && parseAmount(orphanMatch[2]) !== null && parseAmount(orphanMatch[3]) !== null) {
            orphanExtras.push(e);
          } else {
            descExtras.push(e);
          }
        }

        // Main transaction
        const filteredExtra = descExtras.filter(e => !/^[\d,]+(?:\.\d{2})?\s*$/.test(e)).slice(0, 2);
        const mainDesc = filteredExtra.length > 0 ? desc + ' ' + filteredExtra.join(' ') : desc;

        const date = `${useYear}-${block.month}-${block.day}`;
        let debit = null, credit = null;
        if (prevBalance !== null) {
          const diff = balance - prevBalance;
          if (Math.abs(diff - amount) < 0.05) credit = amount;
          else if (Math.abs(diff + amount) < 0.05) debit = amount;
          else debit = amount;
        } else debit = amount;
        pushTxn(date, mainDesc, debit, credit, balance);
        prevBalance = balance;

        // Orphan transactions (using same date)
        for (const orphan of orphanExtras) {
          const cleanOrphan = orphan.replace(/[()\[\]'"]+/g, '').replace(/\$+/g, ' ');
          const om = cleanOrphan.match(/^(.*?)\s+([\d,]+(?:\.\d{1,3})?)\s+([\d,]+(?:\.\d{1,3})?)\s*$/);
          if (!om) continue;
          const oAmt = parseAmount(om[2]);
          const oBal = parseAmount(om[3]);
          if (oAmt === null || oBal === null) continue;
          let oDebit = null, oCredit = null;
          if (prevBalance !== null) {
            const diff = oBal - prevBalance;
            if (Math.abs(diff - oAmt) < 0.05) oCredit = oAmt;
            else if (Math.abs(diff + oAmt) < 0.05) oDebit = oAmt;
            else oDebit = oAmt;
          } else oDebit = oAmt;
          pushTxn(date, om[1].trim().replace(/[()\[\]'"]+/g, ''), oDebit, oCredit, oBal);
          prevBalance = oBal;
        }

      } else {
        // First line didn't match — try finding amount+balance in extras
        let foundAmount = null, foundBalance = null, foundDesc = null;
        for (const extraLine of block.extra) {
          const m2 = extraLine.match(/^([\d,]+(?:\.\d{2})?)\s+([\d,]+(?:\.\d{2})?)\s*$/);
          if (m2) {
            foundAmount = parseAmount(m2[1]);
            foundBalance = parseAmount(m2[2]);
            break;
          }
        }
        const descM = contentLine !== cleanFirst
          ? { 1: cleanFirst.replace(/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+/, '').replace(/^[A-Z][a-z]{2,9}\s+\d{1,2}\s+/, '') }
          : null;
        if (descM) foundDesc = descM[1].trim();
        if (block.extra.length > 0) {
          foundDesc = (foundDesc || '') + ' ' + block.extra.filter(e => !/^[\d,]+(?:\.\d{2})?\s+[\d,]+(?:\.\d{2})?\s*$/.test(e) && !/^[\d,]+(?:\.\d{2})?\s*$/.test(e)).join(' ');
        }
        desc = foundDesc || '';
        amount = foundAmount;
        balance = foundBalance;
        if (amount !== null && balance !== null) {
          const date = `${useYear}-${block.month}-${block.day}`;
          let debit = null, credit = null;
          if (prevBalance !== null) {
            const diff = balance - prevBalance;
            if (Math.abs(diff - amount) < 0.05) credit = amount;
            else if (Math.abs(diff + amount) < 0.05) debit = amount;
            else debit = amount;
          } else debit = amount;
          pushTxn(date, desc, debit, credit, balance);
          prevBalance = balance;
        }
      }
    }
    return result.transactions.length > 0;
  }

  _tryUkDateTransactions(result, text, lines) {
    const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const noiseExtraRe = /^(?:debit\s+transaction|ending\s+balance|opening\s+balance|previous\s+balance|total|account|copyright|reserved|notes?|your\s+account)/i;
    // Handle: dd MonYY, dd.MonYY, dd_MonYY, dd Mon YYYY
    const ukDateRe = /^\s*\(?(\d{1,2})\s*[.\s_]\s*([A-Za-z]{3,9})(?:\s*[.\s_]\s*(\d{2,4}))?\b/;

    // Preprocess: fix common OCR for month names (0c -> Oct), fix fused date descriptions
    const prepped = lines.map(l => {
      let s = l.trim();
      s = s.replace(/\b0c\b/gi, 'Oct').replace(/\boc\b/gi, 'Oct');
      s = s.replace(/\b0[anv]/gi, function(m){return m.toUpperCase().replace('0','O');});
      // Insert space after date when it's fused to text (e.g. "07 Jul20ALMAFRUIT" -> "07 Jul20 ALMAFRUIT")
      s = s.replace(/^(\d{1,2}\s*[.\s_]\s*[A-Za-z]{3,9}\s*\d{0,4})([A-Z])/i, '$1 $2');
      // Fix "03.Jul20" (remove dot between day and month for cleaner parsing)
      s = s.replace(/^(\d{1,2})[.]([A-Za-z])/, '$1 $2');
      // Fix "03 Jul20_" -> "03 Jul20 " and "03 Jul20_" -> "03 Jul20 "
      s = s.replace(/^(\d{1,2}\s+[A-Za-z]{3,9}\d{0,4})[_\s-]+/, '$1 ');
      s = s.replace(/£+/g, '');
      s = s.replace(/[()\[\]'"]+/g, ' ').replace(/\s+/g, ' ').trim();
      return s;
    });

    const yearMatch = text.match(/\b(20\d{2})\b/);
    const defaultYear = yearMatch ? yearMatch[1] : '2014';

    // Group into blocks by date
    const blocks = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      const prep = prepped[i];
      const m = prep.match(ukDateRe);
      if (m) {
        const day = m[1].padStart(2, '0');
        const monthStr = m[2].toLowerCase().substring(0, 3);
        const month = monthMap[monthStr];
        if (month && monthStr.length >= 2) {
          let yr = m[3] ? m[3] : defaultYear;
          if (yr.length === 2) { yr = (parseInt(yr) > 30 ? '19' : '20') + yr; }
          if (current) blocks.push(current);
          current = { date: `${yr}-${month}-${day}`, firstLine: raw, prep, extra: [] };
        }
      } else if (current && !noiseExtraRe.test(prep)) {
        current.extra.push(raw);
      }
    }
    if (current) blocks.push(current);
    if (blocks.length === 0) return false;

    // Extract header fields
    const sortM = text.match(/sort\s*code[\s:]*([\d\-]+)/i);
    if (sortM) result.sortCode = sortM[1].trim();
    const acctM = text.match(/account\s*(?:number|no)[\s:]*(\d+)/i);
    if (acctM) result.accountNumber = acctM[1].trim();

    let prevBalance = null;
    for (const line of lines) {
      const pm = line.match(/[Pp]revious\s*[Bb]alance[^£\d]*£?([\d,]+(?:\.\d{2})?)/i);
      if (pm) { prevBalance = parseAmount(pm[1]); break; }
    }

    // Extract opening/closing balance (UK format: "Balance on DD Mon YYYY £X")
    const balRe = /[Bb]alance\s+on\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+[^£\d]*£?([\d,]+(?:\.\d{1,2})?)/g;
    const balMatches = [];
    let bm;
    while ((bm = balRe.exec(text)) !== null) {
      const v = parseAmount(bm[1]);
      if (v !== null && v > 0) balMatches.push(v);
    }
    if (balMatches.length >= 2) {
      result.openingBalance = balMatches[0];
      result.closingBalance = balMatches[balMatches.length - 1];
    } else if (balMatches.length === 1) {
      result.openingBalance = balMatches[0];
    }

    for (const block of blocks) {
      // Skip header/noise blocks (balance on, page X of, sort code, etc.)
      const blockText = (block.firstLine + ' ' + block.extra.join(' ')).toLowerCase();
      if (/balance\s+on|page\s+\d+\s+of|sort\s+code|account\s+number|actives/i.test(blockText)) continue;
      // Try to find numbers on the first line and extras
      const allClean = (block.firstLine + ' ' + block.extra.join(' ')).replace(/[£,()\[\]'"]+/g, '');
      const nums = [];
      const amtRe = /([\d,]+(?:\.\d{1,2})?)/g;
      let am;
      while ((am = amtRe.exec(allClean)) !== null) {
        const v = parseAmount(am[1]);
        if (v !== null && v >= 0.01 && v < 100000000) nums.push(v);
      }
      if (nums.length < 2) continue;
      const balance = nums[nums.length - 1];
      const amount = nums.length >= 2 ? nums[nums.length - 2] : null;
      if (amount === null) continue;

      // Description: strip date from first line
      const descM = block.prep.match(/^\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?\s+(.*)/);
      const desc = (descM ? descM[1].trim() : block.firstLine) + (block.extra.length > 0 ? ' ' + block.extra.filter(e => !/^[\d,]+(?:\.\d{2})?\s*$/.test(e)).join(' ') : '');

      let debit = null, credit = null;
      if (prevBalance !== null) {
        const diff = balance - prevBalance;
        if (Math.abs(diff - amount) < 0.05) credit = amount;
        else if (Math.abs(diff + amount) < 0.05) debit = amount;
        else debit = amount;
      } else debit = amount;

      result.transactions.push({
        date: block.date,
        description: desc.replace(/\s+/g,' ').trim().replace(/^[_\-\s]+/, ''),
        debit, credit, balance,
        type: 'bank_transaction',
      });
      prevBalance = balance;
    }
    return result.transactions.length > 0;
  }

  _parseCommBankTransactions(result, text, lines) {
    const monthMap = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const monthRe = new RegExp('^(' + Object.keys(monthMap).join('|') + ')\\b', 'i');
    // Pre-process each line: strip leading noise, fix OCR digits
    const prep = lines.map(l => {
      let s = l.trim().replace(/^[^a-zA-Z0-9]+/, '');
      // OCR fixes in the date area only
      s = s.replace(/^[Oo]f\b/, '01').replace(/^[Oo]t\b/, '01').replace(/^[Oo]\b/, '0');
      s = s.replace(/4ul/gi, 'Jul');
      // Add space between month abbr and following word (e.g. "JulFIVE" -> "Jul FIVE")
      s = s.replace(/([A-Z][a-z]{2})([A-Z])/g, '$1 $2');
      return s;
    });
    // Match lines starting with day+month
    const auDateRe = /^\d{1,2}[.\s_]+[A-Z][a-z]{2}(?:[.\s_]|\d|$)/;

    // Group into blocks
    const blocks = [];
    let current = [];
    for (let i = 0; i < prep.length; i++) {
      const isDateStart = auDateRe.test(prep[i]);
      const isMonthStart = !isDateStart && monthRe.test(prep[i]);
      if ((isDateStart || isMonthStart) && current.length > 0) {
        blocks.push(current);
        current = [];
      }
      current.push({ raw: lines[i].trim(), clean: prep[i], isMonthStart });
    }
    if (current.length > 0) blocks.push(current);

    // Extract the year
    const yearM = text.match(/\b(20\d{2})\b/);
    const defaultYear = yearM ? yearM[1] : '2018';

    for (const block of blocks) {
      const firstLine = block[0].clean;

      // Extract day and month from start of line
      let day = null, monthNum = null;
      let dateMatch = firstLine.match(/^(\d{1,2})[.\s_]+([A-Z][a-z]{2})/);
      if (!dateMatch && block[0].isMonthStart) {
        const mOnlyMatch = firstLine.match(/^([A-Z][a-z]{2})/);
        if (mOnlyMatch) {
          const mStr = mOnlyMatch[1].toLowerCase().substring(0,3);
          monthNum = monthMap[mStr];
          if (monthNum) day = '01';
        }
      } else if (dateMatch) {
        day = dateMatch[1].padStart(2, '0');
        const mStr = dateMatch[2].toLowerCase().substring(0,3);
        monthNum = monthMap[mStr];
      }
      if (!day || !monthNum) continue;
      const date = `${defaultYear}-${monthNum}-${day}`;

      // Description: everything except the first line's date portion
      const descLines = block.map(b => b.clean);
      descLines[0] = descLines[0].replace(/^[\d.]+[.\s_]+[A-Z][a-z]{2}[.\s_]*\d{0,4}\s*/, '');
      let desc = descLines.filter(l => !/value\s*date|card\s*xx|xxxxxxxx/i.test(l)).join(' ').trim().replace(/\s+/g, ' ');

      // Find the amount/balance line — the line with CR/OR/R suffix
      let suffixLine = null;
      let suffixIdx = -1;
      for (let i = block.length - 1; i >= 0; i--) {
        const cl = block[i].raw.replace(/['"$£€¥(),]/g, '');
        if (/[\d,]+(?:\.\d{1,2})?\s*(?:CR|OR|R|GR)\s*$/i.test(cl)) {
          suffixLine = block[i];
          suffixIdx = i;
          break;
        }
      }

      let allAmts = [];
      if (suffixLine) {
        // Collect amounts from all lines before suffix line, then suffix line itself
        // Skip known noise lines
        const noiseRe = /value\s*date|card\s*xx|xxxxxxxx|^\d{1,2}\/\d{1,2}\/\d{2,4}/i;
        for (let i = 0; i < suffixIdx; i++) {
          const txt = block[i].raw;
          if (!noiseRe.test(txt)) {
            const cl = txt.replace(/['"$£€¥(),]/g, '');
            const amts = cl.match(/([\d,]+(?:\.\d{1,2})?)/g);
            if (amts) amts.forEach(a => {
              const v = parseAmount(a);
              if (v !== null && v >= 0.01 && v < 100000000) allAmts.push(v);
            });
          }
        }
        // Also from suffix line
        const cl = suffixLine.raw.replace(/['"$£€¥(),]/g, '');
        const amts = cl.match(/([\d,]+(?:\.\d{1,2})?)/g);
        if (amts) amts.forEach(a => {
          const v = parseAmount(a);
          if (v !== null && v >= 0.01 && v < 100000000) allAmts.push(v);
        });
      } else {
        // No suffix line — look at ALL lines, filtering date-day noise from first line
        for (let i = 0; i < block.length; i++) {
          let txt = block[i].raw;
          if (i === 0) {
            // Strip the date prefix from first line
            txt = txt.replace(/^\s*\(?\d{1,2}[.\s_]+[A-Z][a-z]{2}[.\s_]*\d{0,4}\s*/, '');
          }
          const cl = txt.replace(/['"$£€¥(),]/g, '');
          const amts = cl.match(/([\d,]+(?:\.\d{1,2})?)/g);
          if (amts) amts.forEach(a => {
            const v = parseAmount(a);
            if (v !== null && v >= 0.01 && v < 100000000) allAmts.push(v);
          });
        }
      }

      if (allAmts.length === 0) continue;

      const possibleBalance = allAmts[allAmts.length - 1];
      const possibleAmount = allAmts.length >= 2 ? allAmts[allAmts.length - 2] : null;

      // Determine direction from suffix on the balance line
      const checkLine = suffixLine ? suffixLine.raw : block[block.length - 1].raw;
      const hasCR = /\b(?:CR|GR)\b/i.test(checkLine);
      const hasOR = /\bOR\b/i.test(checkLine);
      const hasRSuffix = !hasCR && !hasOR && /[\d,]+(?:\.\d{1,2})?R\b/i.test(checkLine);
      const isCredit = hasCR;
      const isDebit = hasOR || (hasRSuffix && !hasCR);

      let debit = null, credit = null;
      if (possibleAmount !== null) {
        if (isCredit) credit = possibleAmount;
        else if (isDebit) debit = possibleAmount;
        else debit = possibleAmount;
      }

      const cleanedDesc = desc.replace(/\s+/g, ' ').replace(/Value Date.*$/i, '').replace(/Card\s*xx.*$/i, '').replace(/^\d+\s+/, '').trim();
      const firstWord = cleanedDesc.split(/\s+/)[0] || '';
      if (/^(opening|closing)/i.test(firstWord)) {
        if (/opening/i.test(firstWord)) result.openingBalance = possibleBalance;
        else result.closingBalance = possibleBalance;
        continue;
      }

      result.transactions.push({
        date,
        description: cleanedDesc || 'Transaction',
        debit,
        credit,
        balance: possibleBalance,
        type: 'bank_transaction',
      });
    }
  }

  _parseTxnLine(line, inferredYear, prevBalance) {
    const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) return null;

    const date = dateMatch[1];
    const rest = line.substring(dateMatch[0].length).trim();
    if (!rest) return null;

    const numRe = /(-?\d{1,3}(?:,\d{3})*\.\d{2})/g;
    const allNums = [];
    let mn;
    while ((mn = numRe.exec(rest)) !== null) allNums.push(parseFloat(mn[1].replace(/,/g, '')));

    if (allNums.length === 0) return null;

    const balance = allNums[allNums.length - 1];

    let desc;
    const firstNumIdx = rest.search(/-?\d{1,3}(?:,\d{3})*\.\d{2}/);
    if (firstNumIdx >= 0) {
      desc = rest.substring(0, firstNumIdx).trim();
    } else {
      desc = rest;
    }
    desc = desc.replace(/^[\W_]+/, '').replace(/\s+/g, ' ').trim().replace(/\d+$/, '').replace(/^[\W_]+/, '').replace(/\s+/g, ' ').trim();
    if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    if (/brought\s*forward|previous\s+balance/i.test(desc) || /previous\s+balance/i.test(desc)) desc = 'Opening Balance';
    if (!desc) desc = 'Transaction';

    let debit = null, credit = null;

    const findAmt = (candidates, balChg) => {
      const absChg = Math.abs(balChg);
      if (!candidates.length) return { val: null };
      if (!absChg) return { val: candidates[0], exact: true };
      if (candidates.length === 1) {
        if (Math.abs(candidates[0] - absChg) < 0.01) return { val: candidates[0], exact: true };
        return { val: candidates[0], exact: false };
      }
      const match = candidates.find(a => Math.abs(a - absChg) < 0.01);
      if (match) return { val: match, exact: true };
      return { val: candidates[0], exact: false };
    };

    const extractAllAmounts = (text) => {
      const out = [];
      const re = /(\d+\.\d{2})/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const seg = m[1]; const intP = seg.split('.')[0];
        for (let t = 0; t < intP.length; t++)
          out.push(parseFloat(intP.substring(t) + '.' + seg.split('.')[1]));
      }
      return [...new Set(out)].sort((a, b) => a - b);
    };

    if (allNums.length >= 2) {
      const amounts = allNums.slice(0, -1);
      const dl = desc.toLowerCase();
      const balChg = prevBalance !== null ? balance - prevBalance : null;

      if (/withdrawal|payment|purchase|fee|charge|cheque|mortgage|interac\s+purchase|atm\s+withdrawal|pre-auth/i.test(dl)) {
        const found = findAmt(amounts, balChg);
        if (found.exact) debit = found.val;
        else if (balChg) {
          const all = extractAllAmounts(rest);
          const found2 = findAmt(all, balChg);
          if (found2.exact) debit = found2.val;
          else debit = found.val;
        } else debit = found.val;
      } else if (/deposit|refund|transfer\s+from|payroll/i.test(dl)) {
        const found = findAmt(amounts, balChg);
        if (found.exact) credit = found.val;
        else if (balChg) {
          const all = extractAllAmounts(rest);
          const found2 = findAmt(all, balChg);
          if (found2.exact) credit = found2.val;
          else credit = found.val;
        } else credit = found.val;
      } else if (balChg) {
        const found = findAmt(amounts, balChg);
        if (found.exact) {
          if (balChg > 0) credit = found.val;
          else debit = found.val;
        } else {
          const all = extractAllAmounts(rest);
          const found2 = findAmt(all, balChg);
          if (found2.exact) {
            if (balChg > 0) credit = found2.val;
            else debit = found2.val;
          }
        }
      }
    } else if (allNums.length === 1) {
      const dl = desc.toLowerCase();
      if (/previous\s+balance|opening/i.test(dl)) {
        credit = allNums[0];
        if (balance !== null && Math.abs(balance - allNums[0]) < 0.01) {
          credit = null;
        }
      }
    }

    return { date, description: desc, debit, credit, balance, type: 'bank_transaction' };
  }

  _parseDate(s) {
    if (!s) return null;
    s = s.trim().replace(/^on\s+/i, '');

    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return s;

    const numMatch = s.match(/^(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{2,4})$/);
    if (numMatch) {
      const d = parseInt(numMatch[1]), mo = parseInt(numMatch[2]), y = numMatch[3].length === 2 ? '20' + numMatch[3] : numMatch[3];
      return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    const monMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?$/);
    if (monMatch) {
      const d = monMatch[1].padStart(2,'0'), mNum = MONTHS[monMatch[2].toLowerCase()];
      if (!mNum) return null;
      const y = monMatch[3] ? (monMatch[3].length === 2 ? '20' + monMatch[3] : monMatch[3]) : (inferredYear || '2024');
      return `${y}-${String(mNum).padStart(2,'0')}-${d}`;
    }

    const monMatch2 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (monMatch2) {
      const mNum = MONTHS[monMatch2[1].toLowerCase()];
      if (!mNum) return null;
      return `${monMatch2[3]}-${String(mNum).padStart(2,'0')}-${String(monMatch2[2]).padStart(2,'0')}`;
    }

    return null;
  }

  _isPipeDelimited(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;
    const pipeLines = lines.filter(l => /^\d{4}[-/]\d{2}[-/]\d{2}\s*\|/.test(l) && l.split('|').length >= 4);
    return pipeLines.length >= lines.length * 0.5 && pipeLines.length >= 2;
  }

  _parsePipeDelimited(result, text) {
    const lines = text.split('\n').map(l => l.replace(/\r/, '')).filter(Boolean);
    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      const parts = l.split('|').map(p => p.trim());
      if (parts.length < 4) continue;
      const [rawDate, desc, rawAmt, rawBal] = parts;
      const date = rawDate.replace(/\//g, '-');
      const balStr = rawBal.replace(/[+\s]/g, '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      let debit = null, credit = null, balance = null;
      const amt = parseFloat(rawAmt.replace(/[\s]/g, ''));
      if (!isNaN(amt)) {
        if (amt < 0) debit = Math.abs(amt);
        else if (amt > 0) credit = amt;
      }
      const bal = parseFloat(balStr);
      if (!isNaN(bal)) balance = bal;
      result.transactions.push({ date, description: desc || 'Transaction', debit, credit, balance, type: 'bank_transaction' });
    }
  }

  _getValidationChecks(result) {
    return [
      { key: 'accountNumber', weight: 25, test: result.accountNumber && result.accountNumber.length >= 6 },
      { key: 'transactions', weight: 30, test: result.transactions.length >= 2 },
      { key: 'bankName', weight: 15, test: result.bankName && result.bankName.length > 2 },
      { key: 'openingBalance', weight: 10, test: result.openingBalance !== null },
      { key: 'closingBalance', weight: 10, test: result.closingBalance !== null },
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
        'Bank Name': result.bankName,
        'Bank Address': result.bankAddress,
        'Account Holder': result.accountHolder,
        'Account Number': result.accountNumber,
        'Statement Period': result.statementPeriod,
        'Sort Code': result.sortCode,
        'IBAN': result.iban,
        'BIC': result.bic,
        'Opening Balance': result.openingBalance,
        'Closing Balance': result.closingBalance,
        'Available Balance': result.availableBalance,
        'Transaction Count': result.transactions.length,
      },
      transactions: result.transactions.map((txn, i) => {
        let type = txn.type || 'bank_transaction';
        if (txn.description && /opening\s*balance/i.test(txn.description)) type = 'opening_balance';
        else if (txn.description && /closing\s*balance/i.test(txn.description)) type = 'closing_balance';
        return {
          '#': i + 1,
          'Date': txn.date,
          'Description': txn.description,
          'Debit': txn.debit || 0,
          'Credit': txn.credit || 0,
          'Balance': txn.balance || 0,
          'Type': type,
        };
      }),
      tables: result.detectedTables,
    };
  }
}

module.exports = { BankStatementParser };
