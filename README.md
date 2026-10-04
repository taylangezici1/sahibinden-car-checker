<img src="icons/logo.svg" width="72" alt="">

# Oto Fiyat Rehberi

> **Kişisel proje.** İkinci el araba ararken sahibinden.com ilanlarını değerlendirmek için kendi
> kullanımıma yazdığım bir Chrome eklentisi. sahibinden.com ile herhangi bir bağlantısı yoktur,
> Chrome Web Store'da yayında değildir; destek ya da güncelleme sözü verilmez.

Arayüz, teknik bilgisi olmayan biri de rahatça kullanabilsin diye sade Türkçe ve büyük yazıyla hazırlandı.

## Ne yapar?

- sahibinden.com'da açtığınız her araba ilanına **kalite puanı** verir: kilometre, yaş, boyalı ve
  değişen parçalar (hangi parça olduğuna göre), tramer, vites, renk ve garanti.
- Aynı modelden kaydedilen ilanlara bakarak fiyatın, aracın puanına göre **ucuz, normal ya da pahalı**
  olduğunu söyler.
- Arama sonuçlarındaki ilanları **tek tıkla kaydeder**: ilan arka planda açılıp kapanır.
- Kaydedilen bütün ilanları model model karşılaştıran bir sayfa sunar.
- Fiyatı düşen ilanları gösterir; yayından kalkan (satılan) ilanları ayırır.

## Ekran görüntüleri

Görüntülerdeki ilanların hepsi örnek veridir.

### İlan sayfasındaki panel

İlan açılınca sağ alt köşede çıkar. En üstte sonuç, altında tramer bilgisi ve puanı nelerin düşürdüğü görünür.

<img src="docs/screenshots/panel.png" width="380" alt="İlan sayfasındaki panel: Ucuz sonucu, tramer ve puan dökümü">

Tramer ilanda yazmıyorsa ya da yanlışsa panelden girilebilir. Girilen değer ilan tekrar açıldığında da korunur.

<img src="docs/screenshots/tramer.png" width="360" alt="Tramer tutarını girme kutusu">

### Arama sonuçları

Her ilanın altında bir **Kaydet** düğmesi vardır; kaydedilen ilanın puanı ve sonucu orada görünür.
Sağ alttaki kutu sayfada kaç ilanın kayıtlı olduğunu gösterir ve karşılaştırma sayfasına götürür.

<img src="docs/screenshots/arama.png" alt="Arama sonuçlarında Kaydet düğmeleri ve karşılaştırma kutusu">

### Karşılaştırma sayfası

Seçilen modeldeki ilanlar grafikte ve en iyi fırsattan başlayan bir tabloda gösterilir. Çizgi,
puanına göre beklenen fiyattır; çizginin altındaki ilanlar ucuzdur.

<img src="docs/screenshots/dashboard.png" alt="Karşılaştırma sayfası: fiyat ve puan grafiği, en iyi fırsatlar tablosu">

### Puan ayarları

Hangi kusurun kaç puan düşüreceği karşılaştırma sayfasından değiştirilebilir.

<img src="docs/screenshots/ayarlar.png" alt="Puan ayarları formu">

## Nasıl çalışır?

**Puan.** Her araç 100 puandan başlar, kusurlar puanı düşürür. Örneğin her 10.000 km için 3 puan,
her yaş için 4 puan düşer. Boyalı tavan 15, boyalı kaput 10, boyalı ön çamurluk 3 puan düşürür;
lokal boya bunun yarısı sayılır. Bütün değerler değiştirilebilir (bkz. [Puan ayarları](#puan-ayarları)).

**Fiyat.** Aynı modeldeki uygun ilanlar için düz bir çizgi oturtulur:
`fiyat = eğim × puan + sabit` (`cheapest-nft/charting.py` ile aynı yaklaşım). Çizginin altında kalan
ilan, puanına göre ucuzdur. Beklenen fiyatın ±%3'ü içindeki ilanlar "normal fiyat" sayılır. Çizgi
için o modelden en az 5 uygun ilan gerekir.

**Modeller ayrı tutulur.** İlanlar sahibinden'deki "Marka Seri" bilgisine göre gruplanır
("Renault Clio", "Hyundai i20" gibi) ve farklı modeller birbiriyle kıyaslanmaz. Modele özel ayarlar
(izin verilen paketler, paket puanları, en düşük model yılı) `src/lib/config.js` içinde tanımlanır.

**Tramer.** İlanda tutar yazıyorsa o kullanılır. Yazmıyorsa "tramer kaydı yok", "hasar kayıtsız",
"hatasız" ya da "boyasız" gibi ifadelerden 0 kabul edilir. Panelden elle de girilebilir.

**Kategoriler.** Otomobil ile Arazi, SUV & Pickup kategorilerindeki ilanlar desteklenir.

**Fiyat değişimi.** Bir ilan her açıldığında ya da kaydedildiğinde fiyatı yeniden okunur; fiyat
değiştiyse geçmişe eklenir. Panel "▼ Fiyatı düştü: 1.195.000 → 1.135.000 TL" gibi bir satır gösterir,
karşılaştırma sayfasında fiyatın altında düşüş tutarı yazar ve **Sadece fiyatı düşen ilanlar**
seçeneğiyle yalnız onlar listelenebilir. Fiyat kendiliğinden güncellenmez: ilanın tekrar açılması ya
da Kaydet'e tekrar basılması gerekir.

**Yayından kalkan ilanlar.** Kayıtlı bir ilan açıldığında sayfa ilanın yayında olmadığını söylüyorsa
ilan "yayından kalktı" diye işaretlenir. Bu ilanlar fiyat çizgisine, sıralamaya ve sayılara katılmaz;
karşılaştırma sayfasındaki ayrı bölümde son fiyatları ve kalktıkları tarihle durur. İlan tekrar
yayında görülürse işaret kalkar.

**Veriler.** Her şey tarayıcının kendi deposunda (`chrome.storage.local`) saklanır, hiçbir yere gönderilmez.

### Kaydet düğmesi neden ilanı sekmede açıyor?

Arama sonuçlarındaki **Kaydet** düğmesi üç denemede bugünkü haline geldi:

1. **Arka planda indirme.** İlk sürüm ilan sayfasını sekme açmadan, arka planda indirip (`fetch`)
   okuyordu. Bir sayfadaki bütün ilanları 1–2 saniye arayla indirmek hesabın engellenmesine yol açtı.
2. **Yavaşlatılmış indirme.** İstekler arasına 10–20 saniye bekleme, bütün sekmeler için tek bir sıra
   ve engel görülünce 60 dakika durma eklendi. Kaydet düğmelerine art arda basmak yine de başka bir
   hesabın engellenmesine yol açtı. Arka planda indirilen sayfada sahibinden'in kendi kodları hiç
   çalışmıyor; istek, sayfayı gerçekten açan birinin isteğine benzemiyordu.
3. **Gerçek sekme (şimdiki hali).** Kaydet'e basınca ilan arka planda yeni bir sekmede normal şekilde
   açılır, sayfadaki panel ilanı okuyup kaydeder ve sekme kapanır (`saveViaTab`, `src/background.js`).
   Yani her tıklama, ilanı kendiniz yeni sekmede açıp kapatmanızla aynı şeydir. Bekleme ya da sıra
   yoktur, sekme düğmeye basıldığı anda açılır.

Bu, sahibinden'in korumasını atlatmak değil; eklenti yalnızca sizin tıkladığınız ilanı açar, toplu
ya da kendiliğinden ilan açmaz. Yine de engellenmeyeceğinin garantisi yoktur: çok sayıda ilanı çok
hızlı art arda kaydetmek, elle hızlı gezmek gibi, engellenmeye yol açabilir. sahibinden doğrulama
sayfası gösterirse o sekme kapanmaz, öne gelir; doğrulamayı orada tamamlayabilirsiniz.

## Kurulum

Eklenti Chrome'a "paketlenmemiş öğe" olarak yüklenir:

1. Repoyu indirin (`git clone` ya da GitHub'da **Code → Download ZIP**) ve kalıcı bir klasöre koyun, örneğin `C:\OtoFiyatRehberi`.
2. Chrome'da `chrome://extensions` adresini açın ve sağ üstten **Geliştirici modu**'nu açın.
3. **Paketlenmemiş öğe yükle**'ye basıp klasörü seçin.
4. Araç çubuğundaki yapboz simgesinden eklentiyi sabitleyin.

Dikkat edilecekler:

- **Klasörün yerini değiştirmeyin, eklentiyi kaldırmayın.** Chrome kaydedilen ilanları ve ayarları
  klasörün yoluna bağlı tutar; yol değişirse ya da eklenti kaldırılırsa hepsi kaybolur.
- **Geliştirici modunu kapatmayın**, kapatılırsa eklenti devre dışı kalır.
- **Güncelleme:** yeni dosyaları aynı klasöre kopyalayın, sonra `chrome://extensions` sayfasında eklentinin ⟳ simgesine basın.

## Kullanım

- **İlan sayfası:** Bir araba ilanı açtığınızda panel kendiliğinden çıkar ve ilan kaydedilir.
- **Arama sonuçları:** İlanın altındaki **Kaydet**'e basın. İlan hemen arka planda yeni bir sekmede
  açılır, panel onu okuyup kaydeder ve sekme kapanır (neden böyle olduğu için bkz.
  [Kaydet düğmesi neden ilanı sekmede açıyor?](#kaydet-düğmesi-neden-ilanı-sekmede-açıyor)).
  sahibinden doğrulama sayfası gösterirse (ya da ilan 30 saniye içinde açılmaz ve başka bir sayfaya
  yönlenirse) o sekme kapanmaz, öne gelir; doğrulamayı orada tamamlayabilirsiniz.
- **Karşılaştırma sayfası:** Araç çubuğundaki simgeye tıklayıp **Kaydedilen ilanları karşılaştır**'a
  ya da paneldeki mavi düğmeye basın.
- **Puan ayarları:** Karşılaştırma sayfasında **⚙ Puan ayarları**. Değişiklikler kendiliğinden kaydedilir.
- **Yedekleme:** Karşılaştırma sayfasının altındaki **Yedekleme** bölümünden bütün ilanlar dosyaya
  alınabilir ve başka bir bilgisayara yüklenebilir. Puan ayarları yedeğe dahil değildir.

## Geliştirme

### Dosyalar

- `manifest.json`: eklenti tanımı. Görünen ad yalnızca burada (`name`); panel, popup ve karşılaştırma sayfası adı buradan okur.
- `src/lib/config.js`: önerilen puan ağırlıkları, filtreler ve model profilleri (`models`).
- `src/lib/scoring.js`: bir ilanın filtreleri ve puan dökümü, model gruplama, ayarların birleştirilmesi.
- `src/lib/regression.js`: en küçük kareler çizgisi, beklenen fiyat ve ucuz/normal/pahalı kararı.
- `src/lib/storage.js`: ilanlar, elle girilen değerler ve kullanıcı ayarları.
- `src/content/parser.js`: ilan sayfasını okur (bilgi tablosu, fiyat, boya/değişen şeması, tramer). Desteklenen kategoriler `SCC.CAR_CATEGORIES`.
- `src/content/panel.js`, `content.js`: ilan sayfasındaki panel.
- `src/content/results.js`: arama sonuçlarındaki Kaydet düğmeleri ve sağ alttaki kutu.
- `src/background.js`: ilanı arka planda sekmede açıp kapatan kısım (`saveViaTab`) ve karşılaştırma sayfasını açma.
- `dashboard/`: karşılaştırma sayfası (grafik, tablolar, `settings.js` ile puan ayarları formu).
- `popup/`: araç çubuğu simgesine tıklayınca açılan küçük pencere.
- `icons/logo.svg`: logo. `icon-*.png` dosyaları bundan üretildi; sahibinden sayfalarındaki arayüz `src/lib/logo.js` içindeki aynı çizimi kullanır.

### Notlar

- **Ayarlar:** `config.js` önerilen değerleri tutar. Puan ayarları formu yalnızca bunlardan farklı
  olan değerleri kaydeder (`chrome.storage.local` → `settings`) ve her sayfa bunları `config.js`'in
  üzerine bindirir (`SCC.storage.loadSettings()`). Böylece `config.js`'te sonradan yapılan
  değişiklikler, kullanıcının dokunmadığı ayarlara yine ulaşır.
- **Ham veri:** İlanlar okunduğu haliyle saklanır, puanlar her açılışta yeniden hesaplanır. `config.js`
  ya da ayarlar değişince kayıtlı bütün ilanlar yeniden puanlanır.
- **Elle girilen değerler** (şimdilik yalnızca tramer) `listing.overrides` içinde durur ve ilan
  tekrar okunsa da sayfadan okunanın önüne geçer.
- **Kategoriler:** `SCC.CAR_CATEGORIES` (`parser.js`) ile `manifest.json`'daki ilk içerik betiğinin
  `matches` listesi aynı tutulmalı.
- **Parser sahibinden'in HTML'ine bağlıdır.** Sayfa yapısı değişince alanlar boş gelir ve panel
  "Bu ilan okunamadı" der. **Sayfayı kaydet** düğmesiyle sayfanın HTML'ini alıp `fixtures/` klasörüne
  koyun ve parser'ı ona göre düzeltin. Bu dosyalar git'e girmez: oturum açıkken kaydedilen sayfalarda
  hesap adı, ilanlarda satıcı telefonları bulunur.
- **Kodu değiştirdikten sonra** `chrome://extensions` sayfasında ⟳ simgesine basın ve sahibinden sekmesini yenileyin.
