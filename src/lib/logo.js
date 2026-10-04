var SCC = globalThis.SCC || (globalThis.SCC = {});

// The logo for content-script UI on sahibinden pages. Same drawing as icons/logo.svg,
// inlined because extension files can't be loaded into the page without exposing them.
SCC.LOGO_SVG = `<svg viewBox="0 0 128 128" aria-hidden="true">
  <rect x="4" y="4" width="120" height="120" rx="28" fill="#1d5fb8"/>
  <path d="M14 70V58q0-6 6-7l10-2 10-15q2-3 6-3h26q4 0 7 3l13 14 10 2q6 1 6 7v13z" fill="#fff"/>
  <path d="M42 47l6-10h10v10zM62 47V37h10l10 10z" fill="#1d5fb8"/>
  <circle cx="34" cy="70" r="12" fill="#1d5fb8"/><circle cx="86" cy="70" r="12" fill="#1d5fb8"/>
  <circle cx="34" cy="70" r="7" fill="#fff"/><circle cx="86" cy="70" r="7" fill="#fff"/>
  <circle cx="100" cy="100" r="22" fill="#16a34a" stroke="#fff" stroke-width="5"/>
  <path d="M89 100l7 7 14-14" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
