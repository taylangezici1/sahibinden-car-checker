var SCC = globalThis.SCC || (globalThis.SCC = {});

// The "Puan ayarları" form. Each row is a plain sentence with the number inside it.
// Penalties are shown as positive "puan düşsün" amounts; config.js stores them as
// negative points. Only values that differ from config.js are saved.
(() => {
  const { int, tl } = SCC.format;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const get = (obj, path) => path.reduce((o, k) => o?.[k], obj);
  const set = (obj, path, value) => {
    let o = obj;
    for (const k of path.slice(0, -1)) o = o[k] ??= {};
    o[path.at(-1)] = value;
  };

  const PAINT_PARTS = [
    ['roof', 'Tavan'],
    ['frontHood', 'Motor kaputu'],
    ['rearHood', 'Bagaj kapağı'],
    ['rearMudguard', 'Arka çamurluk'],
    ['door', 'Kapı'],
    ['frontMudguard', 'Ön çamurluk'],
    ['bumper', 'Tampon'],
    ['other', 'Diğer parçalar'],
  ];

  // `{}` marks where the number box goes. Paths are under config.scoring.
  // kind: 'penalty' = shown positive, stored negative; 'percent' = ratio shown as 0-100.
  function sections(d) {
    return [
      {
        title: 'Kilometre ve yaş',
        fields: [
          { path: ['km', 'points'], kind: 'penalty', text: `Her ${int(d.km.every)} km için {} puan düşsün` },
          { path: ['perYearOld'], kind: 'penalty', text: 'Araç her yıl eskidikçe {} puan düşsün' },
        ],
      },
      {
        title: 'Boyalı parçalar',
        note: 'Tamamen boyanmış bir parça için kaç puan düşsün? Tavan ve kaput gibi önemli parçalar daha çok düşürmeli.',
        fields: [
          ...PAINT_PARTS.map(([key, label]) => ({ path: ['paint', key], kind: 'penalty', text: `${label}: {} puan` })),
          { path: ['localPaintFactor'], kind: 'percent', text: 'Lokal boya, tam boyanın yüzde {} kadarı sayılsın (50 = yarısı)' },
        ],
      },
      {
        title: 'Tramer (hasar kaydı)',
        fields: [
          { path: ['tramer', 'points'], kind: 'penalty', text: `Her ${tl(d.tramer.every)} tramer için {} puan düşsün` },
          { path: ['tramer', 'max'], kind: 'penalty', text: 'Tramer ne kadar yüksek olursa olsun en fazla {} puan düşsün' },
          { path: ['unknownTramer'], kind: 'penalty', text: 'Tramer bilinmiyorsa {} puan düşsün' },
        ],
      },
      {
        title: 'Diğer',
        fields: [
          { path: ['unknownDamageInfo'], kind: 'penalty', text: 'İlanda boya / değişen bilgisi yoksa {} puan düşsün' },
          ...Object.keys(d.gear).map((g) => ({ path: ['gear', g], kind: 'penalty', text: `${g} vitesse {} puan düşsün` })),
          ...Object.keys(d.color).map((c) => ({ path: ['color', c], kind: 'penalty', text: `${c} renkse {} puan düşsün` })),
          { path: ['noWarranty'], kind: 'penalty', text: 'Garantisi yoksa {} puan düşsün' },
        ],
      },
    ];
  }

  const toShown = (f, v) => (f.kind === 'percent' ? Math.round(v * 100) : f.kind === 'penalty' ? Math.abs(v) : v);
  const toStored = (f, n) => (f.kind === 'percent' ? n / 100 : f.kind === 'penalty' ? -Math.abs(n) : n);
  const sameValue = (a, b) => Math.abs(a - b) < 1e-9;

  SCC.settingsForm = {
    // Builds the form from config.js defaults and the settings in effect (SCC.config).
    mount(container, status) {
      const defaults = SCC.defaultConfig.scoring;
      const current = SCC.config.scoring;
      const all = sections(defaults);
      const fields = all.flatMap((s) => s.fields);

      const row = (f, i) => {
        const shown = toShown(f, get(current, f.path));
        const preset = toShown(f, get(defaults, f.path));
        const [before, after] = f.text.split('{}');
        return `<label class="setting">
          <span>${esc(before)}<input type="number" min="0" max="100" step="0.5" inputmode="decimal"
            data-field="${i}" value="${shown}">${esc(after)}</span>
          <small class="preset" ${sameValue(shown, preset) ? 'hidden' : ''}>önerilen: ${preset}</small>
        </label>`;
      };

      let i = 0;
      container.innerHTML = all
        .map(
          (s) => `<fieldset>
            <legend>${esc(s.title)}</legend>
            ${s.note ? `<p class="sub">${esc(s.note)}</p>` : ''}
            ${s.fields.map((f) => row(f, i++)).join('')}
          </fieldset>`,
        )
        .join('');

      let statusTimer;
      const say = (text) => {
        status.textContent = text;
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => (status.textContent = ''), 4000);
      };

      container.onchange = async (e) => {
        const input = e.target.closest('input[data-field]');
        if (!input) return;
        const f = fields[input.dataset.field];
        const n = Number(String(input.value).replace(',', '.'));
        if (input.value === '' || !Number.isFinite(n)) {
          input.value = toShown(f, get(SCC.config.scoring, f.path));
          return;
        }
        input.value = Math.abs(n);
        const preset = toShown(f, get(defaults, f.path));
        input.closest('.setting').querySelector('.preset').hidden = sameValue(Math.abs(n), preset);

        // Rebuild the whole saved object from the form, keeping only what differs from config.js.
        const scoring = {};
        container.querySelectorAll('input[data-field]').forEach((el) => {
          const field = fields[el.dataset.field];
          const stored = toStored(field, Math.abs(Number(String(el.value).replace(',', '.'))));
          if (!sameValue(stored, get(defaults, field.path))) set(scoring, field.path, stored);
        });
        await SCC.storage.saveSettings(Object.keys(scoring).length ? { scoring } : {});
        say('Kaydedildi. Bütün ilanların puanı yeniden hesaplandı.');
      };
    },

    async reset(container, status) {
      if (!confirm('Bütün puan ayarları önerilen değerlere dönsün mü?')) return;
      await SCC.storage.saveSettings({});
      await SCC.storage.loadSettings();
      SCC.settingsForm.mount(container, status);
      status.textContent = 'Önerilen değerlere dönüldü.';
    },
  };
})();
