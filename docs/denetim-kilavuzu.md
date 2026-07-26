# Denetim raporunu nasıl savunursunuz

Bu belge `docs/self-audit.md` dosyasındaki raporun **yöntemini** anlatır. Rakamları
tekrarlamaz — rakamlar orada, ve her birinin yanında onu yeniden üreten komut var. Burada
anlatılan şey, birisi size "bu ne demek, nereden biliyorsun?" diye sorduğunda
verebileceğiniz cevaptır.

Rapor İngilizce ve öyle kalıyor. Sebebi tercih değil: rapor bir şablondan üretiliyor, ve
şablonun ikinci bir dili olsaydı iki dil zamanla birbirinden ayrışırdı — bu aracın bulmak
için var olduğu kusurun tam olarak kendisi. Bunun yerine yöntem burada, tek dilde ve
rakamlardan bağımsız olarak anlatılıyor, çünkü yöntem rakamlar değiştiğinde değişmiyor.

---

## Bir cümlede ne yapıyor

**Kodun ne olduğunu okur, ne olduğu söylenene bakmaz, ve aradaki farkı tarihiyle birlikte
yazar.**

"Tarihiyle birlikte" kısmı önemli. İki dosyanın aynı sayıyı kullandığını söylemek, karşı
tarafın kendisinin de `grep` ile bulabileceği bir şeydir. İkincisinin ne zaman, hangi
commit'te, hangi işi yaparken ortaya çıktığını söylemek başka bir şeydir.

---

## Üç katman

Bu, observatory'deki mimarinin aynısı ve raporun güvenilirliği buna dayanıyor.

**GERÇEKLİK.** Depoda ne var. Sadece eklenir, hiç güncellenmez. Bir satır şunu der: "bu
dosyada, bu satırda, bu ifade, bu sayıyla karşılaştırılıyor." Yorum yok, karar yok.

**YORUM.** Bundan ne sonuç çıkarıyoruz. Sürümlü ve **atılabilir.** Her bulgu, üstteki
satırlardan yeniden üretilebilir. Yöntemi düzelttiğimizde eski bulgular çöpe gitmez;
`restate` komutu hepsini yeni yöntemle yeniden yazar, kimliklerini koruyarak.

**Neden önemli:** biri "bu rakama nereden vardın" derse, cevap bir hafızada ya da bir
sohbette değil. Gözlem satırları duruyor, yöntem sürümü yazılı, ve komut ekte.

---

## İki dedektör, ve her birinin ne dediği

### 1. `duplicate_threshold_set` — aynı sınır, iki dosyada

**Ne diyor:** bir ifade, aynı sayıyla, birden fazla dosyada karşılaştırılıyor.

Örnek: `risk.riskScore >= 90` hem `policyEngineService.js` hem
`allocationEngineService.js` içinde. Aynı puan, iki ayrı yerde, aynı üç sınırda.

**Ne zaman sorun olur:** birisi bu sayılardan birini değiştirdiği gün. Bir dosyayı açar,
`90`'ı `85` yapar, test eder, yayınlar. Öbür dosya hâlâ `90` tutuyor. O andan sonra program
aynı puanı, isteğin hangi yoldan geldiğine göre iki farklı sınıra göre değerlendiriyor — ve
**testler bunu yakalamaz**, çünkü her dosya kendi içinde tutarlı.

**Ne demiyor:** iki dosyanın aynı sınırda anlaşması kasıtlı olabilir. Rapor bunun bir hata
olduğunu söylemiyor; sayının birden fazla yerde olduğunu ve ne zamandır öyle olduğunu
söylüyor. Karar okuyucunun.

**Size sorulabilecek soru:** *"Bu bir lint kuralı değil mi zaten?"*
Cevap: hayır, çünkü lint bir dosyaya bakar. Buradaki iddia iki dosya arasında, ve asıl
bilgi tarihte: ikisinin ne zaman ayrıştığı, o commit'in ne yaparken bunu yaptığı, ve o
günden beri birinin düzenlenip diğerinin düzenlenmediği.

### 2. `unimported_module` — programın adını hiç yazmadığı dosyalar

**Ne diyor:** bir dizindeki şu dosyaların adı, programın hiçbir yerinde geçmiyor. Ne
`import`, ne `require`, ne de bir dosya yükleyene verilen yol olarak.

**Ne zaman sorun olur:** birisi o dizini okuyup inandığı gün. En keskin hâli şudur:
**dokümantasyon o modülü sistemin parçası gibi anlatıyor, ama hiçbir şey onu çağırmıyor.**
Bir değişiklik planlayan kişi dokümanı okur, bütçesini ona göre yapar, ve sonradan öğrenir
— ya da daha kötüsü, kodu değiştirir ve hiçbir etki görmez.

**Ne demiyor:** bu dosyalar kullanılmıyor demiyor. Bir modül import edilmeden de
yüklenebilir — bir servis yöneticisinden, bir container komutundan, bir `<script>`
etiketinden. Rapor bunları zaten eliyor: JavaScript dışı herhangi bir dosya adı geçiriyorsa
bulgu üretilmiyor. Ama depo dışında yaşayan bir yükleyici depo içinde iz bırakmaz.

Silinmeli de demiyor. Henüz bağlanmamış bir modül ile bağlıyken yetim kalmış bir modül
dışarıdan aynı görünür — ve rapor ikisini ayırıyor: "hiç çağıranı olmamış" ile "bir zamanlar
vardı" farklı satırlarda.

**Size sorulabilecek soru:** *"Bağımlılık enjeksiyonu kullanıyorsam bu araç yanılmaz mı?"*
Cevap: hayır, ve bu bilerek böyle. Araç **erişilebilirlik analizi yapmıyor** — o, bu tür bir
kod tabanında yanlış cevap verirdi, çünkü `evaluatePipeline` tüm iş ortaklarını argüman
olarak alıyor ve naif bir import grafiği `src/services`'in çoğunu ölü sayardı. Sorduğu soru
çok daha zayıf ve kontrol edilebilir: **programın herhangi bir satırı bu dosyanın adını
yazıyor mu.** Enjeksiyon da adı yazar — enjekte edildiği yerde.

---

## Neden rakamlara güvenebilirsiniz

Üç ayrı mekanizma var ve üçü de bağımsız.

**1. Her rakam ikinci bir yoldan yeniden hesaplanıyor.** Dedektör kendi tarayıcısının
veritabanına yazdığı satırları sayıyor; doğrulayıcı git'in kendi regex motoruna aynı soruyu
soruyor. **Anlaşmazlarsa bulgu yayınlanmıyor** — reddedilen bulgu, uyuşmazlığıyla birlikte
kayda geçiyor.

**2. Her rakamın yanında onu üreten komut var.** Şu an raporda on altı rakam ve on altı
komut var; hepsini birebir kopyalayıp çalıştırdım, hepsi yanındaki sayıyı üretiyor. Bu
önemsiz bir ayrıntı değil: bir noktada dört komut **sahteydi** — üçü `<basename>` yer
tutuculu taslaktı, dördüncüsü kabuk içinde yanlış tırnaklama yüzünden hiçbir şey aramıyordu
ve bulmadığı için rakamla "uyuşuyordu".

**3. Hiçbir şey kendini yayınlamıyor.** Her bulgu bir kuyrukta bekler ve bir insan onaylar.
Ben onayladım; sizin de reddetme hakkınız var ve reddedilen bulgu da kayda geçer.

---

## Aracın bilerek yapmadığı şeyler

Biri size "neden şunu da yapmıyor" derse, cevapları bunlar:

**Tavsiye vermiyor.** Ne yapılması gerektiği okuyucunun kararı ve aracın göremediği şeylere
bağlı. Rapor olguyu ve tarihini verir.

**Kod kalitesi puanı vermiyor.** Bulgu sayısı bir not değil. Dokuz repoda ölçtük: olgun
kütüphanelerde 0–1, on yıllık bir üründe 6, iki kişisel projede 6 ve 6. İzlediği şey
**ikinci bir okuyucu olmadan büyüme**, yetenek değil.

**Okuyamadığı yeri okumuş gibi yapmıyor.** Raporun başında kaç dosyadan kaçının okunduğu
yazıyor. Bu satır bir kibarlık değil: araç TypeScript okuyamazken etherpad-lite'ın 1108
dosyasından 12'sini okuyup "0 bulgu" demişti. O rakam **doğruydu** ve bir denetim değildi.
Şimdi 299 dosya okuyor ve 6 bulgu üretiyor.

**Kısaltılmış geçmişte tarih vermiyor.** Sığ bir klon (CI'ın varsayılanı) verilirse hiçbir
şey tarihlenmiyor. Çünkü git'in verebileceği her tarih, gerçekten bilinmeyen bir uzaklıkta
bir alt sınırdır — ve "bilinmiyor" mevcut tek dürüst cevaptır.

---

## Bir şeyi bilmiyorsanız söylenecek doğru cümle

*"Bilmiyorum, ama rakamı üreten komut raporun içinde — birlikte çalıştıralım."*

Bu cümle bu aracın var oluş sebebidir. Rapor, okuyucunun ona inanmasını gerektirmeyecek
şekilde yazıldı; her iddianın yanında onu kendi başına doğrulayacağı yol var. Sizin her
rakamı ezbere savunmanız gerekmiyor — **savunması gereken rapor, siz değilsiniz.**
