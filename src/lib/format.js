var SCC = globalThis.SCC || (globalThis.SCC = {});

SCC.format = {
  // "1.250.000 TL" -> 1250000, "12,5 bin" -> 12500, "45.000" -> 45000
  parseNumber(text) {
    if (text == null) return null;
    const m = String(text).toLowerCase().match(/(\d[\d.,]*)\s*(bin|k)?\b/);
    if (!m) return null;
    let raw = m[1];
    const thousands = Boolean(m[2]);
    if (thousands) {
      raw = raw.replace(/\./g, '').replace(',', '.');
      return Math.round(parseFloat(raw) * 1000);
    }
    // Turkish formatting: dot = thousands separator, comma = decimal.
    raw = raw.replace(/\./g, '').replace(/,\d*$/, '');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  },

  tl(n) {
    if (n == null || !Number.isFinite(n)) return '–';
    return `${Math.round(n).toLocaleString('tr-TR')} TL`;
  },

  int(n) {
    if (n == null || !Number.isFinite(n)) return '–';
    return Math.round(n).toLocaleString('tr-TR');
  },

  signed(n, digits = 0) {
    if (n == null || !Number.isFinite(n)) return '–';
    const s = n.toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
    return n > 0 ? `+${s}` : s;
  },

  pct(ratio) {
    if (ratio == null || !Number.isFinite(ratio)) return '–';
    return `${SCC.format.signed(ratio * 100, 1)}%`;
  },

  // Quality score as shown to the user: whole points read easier than 87,3.
  score(n) {
    if (n == null || !Number.isFinite(n)) return '–';
    return Math.round(n).toLocaleString('tr-TR');
  },

  // "bugün", "dün", "12 gün önce" for an ISO date.
  ago(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (!Number.isFinite(days)) return '';
    return days <= 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`;
  },

  // Unsigned, Turkish style: 0.032 -> "%3,2"
  percent(ratio) {
    if (ratio == null || !Number.isFinite(ratio)) return '–';
    return `%${Math.abs(ratio * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
  },

  clean(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  },
};
