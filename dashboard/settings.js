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
  // The cards flow down two columns (dashboard.css); the long paint card goes last so
  // the three short ones fill the first column and the columns come out even.
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
      {
        title: 'Boyalı parçalar',
        note: 'Tamamen boyanmış bir parça için kaç puan düşsün? Tavan ve kaput gibi önemli parçalar daha çok düşürmeli.',
        fields: [
          ...PAINT_PARTS.map(([key, label]) => ({ path: ['paint', key], kind: 'penalty', text: `${label}: {} puan` })),
          { path: ['localPaintFactor'], kind: 'percent', text: 'Lokal boya, tam boyanın yüzde {} kadarı sayılsın (50 = yarısı)' },
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
        await SCC.storage.editSettings((s) => {
          if (Object.keys(scoring).length) s.scoring = scoring;
          else delete s.scoring;
          return s;
        });
        say('Kaydedildi. Bütün ilanların puanı yeniden hesaplandı.');
      };
    },

    async reset(container, status) {
      if (!confirm('Bütün puan ayarları önerilen değerlere dönsün mü?')) return;
      await SCC.storage.editSettings((s) => {
        delete s.scoring;
        return s;
      });
      await SCC.storage.loadSettings();
      SCC.settingsForm.mount(container, status);
      status.textContent = 'Önerilen değerlere dönüldü.';
    },
  };

  // ---- "<Model> ayarları": the lowest model year, and for each sahibinden "Model" name
  // seen in this model's saved listings whether it's in and its extra points. Saved under
  // settings.models[key] (see SCC.variantChoice), keeping only what differs from config.js.
  SCC.modelForm = {
    key: null,
    models: [], // [[sahibinden Model name, listings]] on the form, most common first

    // Model names in this group's saved listings, most common first.
    modelsOf(group) {
      const counts = new Map();
      for (const r of [...group.rows, ...group.gone]) {
        if (r.listing.model) counts.set(r.listing.model, (counts.get(r.listing.model) || 0) + 1);
      }
      return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'));
    },

    // Rebuilds the form unless it already shows this model with the same names, or the
    // reader is typing in it.
    show(container, status, group, force = false) {
      const models = this.modelsOf(group);
      const same = this.key === group.key && JSON.stringify(models.map(([m]) => m)) === JSON.stringify(this.models.map(([m]) => m));
      if (!force && (same || container.contains(document.activeElement))) return;
      this.mount(container, status, group, models);
    },

    mount(container, status, group, models = this.modelsOf(group)) {
      const key = group.key;
      this.key = key;
      this.models = models;
      const preset = SCC.configFor(key, SCC.defaultConfig); // config.js alone
      const current = group.config; // with the saved settings
      const choice = (model, config) => SCC.variantChoice({ model, title: '' }, config);

      const rows = models
        .map(([model, n], i) => {
          const c = choice(model, current);
          return `<tr>
            <td><input type="checkbox" data-variant="${i}" ${c.include ? 'checked' : ''} aria-label="${esc(model)} dahil"></td>
            <td>${esc(model)} <small>${n} ilan</small></td>
            <td class="num"><input type="number" step="1" data-points="${i}" value="${c.points}" aria-label="${esc(model)} ek puan"></td>
          </tr>`;
        })
        .join('');
      container.innerHTML = `
        <label class="setting year">
          <span>En düşük model yılı<input type="number" min="1950" max="2100" step="1" data-min-year value="${current.filters.minYear ?? ''}" placeholder="—"></span>
          <small class="preset">Boş bırakırsanız yıl sınırı olmaz.</small>
        </label>
        <p class="sub">
          İstemediğiniz paketlerin işaretini kaldırın; o ilanlar "uymayan ilanlar" bölümüne geçer. Daha dolu
          donanımlı paketlere artı puan verebilirsiniz (örneğin 5). Liste, bu modelden kaydettiğiniz ilanlardan
          oluşur; yeni bir paket görüldüğünde buraya eklenir.
        </p>
        ${
          models.length
            ? `<div class="table-wrap"><table class="variants">
                <thead><tr><th>Dahil</th><th>Paket / model (sahibinden'deki adıyla)</th><th class="num">Ek puan</th></tr></thead>
                <tbody>${rows}</tbody>
              </table></div>`
            : '<p class="sub">Bu modelden henüz kayıtlı ilan yok.</p>'
        }`;

      let statusTimer;
      container.onchange = async (e) => {
        const yearInput = container.querySelector('[data-min-year]');
        let year = yearInput.value === '' ? null : Math.round(Number(yearInput.value));
        if (year !== null && !Number.isFinite(year)) {
          year = current.filters.minYear ?? null;
          yearInput.value = year ?? '';
        }
        if (e.target.matches('[data-points]') && !Number.isFinite(Number(e.target.value.replace(',', '.')))) e.target.value = 0;

        // Rebuild this model's entry from the form, keeping only what differs from config.js.
        const entry = {};
        if (year !== (preset.filters.minYear ?? null)) entry.filters = { minYear: year };
        const variants = {};
        models.forEach(([model], i) => {
          const base = choice(model, preset);
          const include = container.querySelector(`[data-variant="${i}"]`).checked;
          const points = Number(String(container.querySelector(`[data-points="${i}"]`).value).replace(',', '.')) || 0;
          const own = {};
          if (include !== base.include) own.include = include;
          if (points !== base.points) own.points = points;
          if (Object.keys(own).length) variants[model] = own;
        });
        if (Object.keys(variants).length) entry.variants = variants;

        await SCC.storage.editSettings((s) => {
          s.models = s.models || {};
          if (Object.keys(entry).length) s.models[key] = entry;
          else delete s.models[key];
          if (!Object.keys(s.models).length) delete s.models;
          return s;
        });
        status.textContent = 'Kaydedildi. Bu modelin ilanları yeniden değerlendirildi.';
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => (status.textContent = ''), 4000);
      };
    },

    async reset(container, status, group) {
      if (!confirm(`${group.key} için yapılan bütün ayarlar silinsin mi?`)) return;
      this.key = null; // the redraw that follows the save rebuilds the form with the defaults
      await SCC.storage.editSettings((s) => {
        if (s.models) delete s.models[group.key];
        if (s.models && !Object.keys(s.models).length) delete s.models;
        return s;
      });
      status.textContent = 'Önerilen değerlere dönüldü.';
    },
  };
})();
