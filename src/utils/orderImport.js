export function normalizeMobile(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('8860')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('886')) {
    digits = `0${digits.slice(3)}`;
  }

  if (digits.length === 9 && digits.startsWith('9')) {
    digits = `0${digits}`;
  }

  return digits;
}

export function parseCustomerField(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/^(.*?)[\s　]*[（(]([^)）]+)[)）]\s*$/);

  if (match) {
    return {
      name: match[1].trim(),
      mobile: normalizeMobile(match[2]),
    };
  }

  const mobile = normalizeMobile(text);
  if (mobile.length >= 9) {
    return { name: '', mobile };
  }

  return { name: text, mobile: '' };
}

export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => String(cell).trim() !== ''));
}

export function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => String(header).trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });
    return record;
  });
}

export function toNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}
