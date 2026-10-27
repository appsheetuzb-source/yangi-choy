/*
  PWA o'rnatish taklifini ERTA ushlab qolish.

  Brauzer `beforeinstallprompt` ni sahifa yuklanishi bilanoq (~200 ms) otadi — React ishga
  tushishidan OLDIN. Hodisani faqat komponent useEffect'ida kutsak, u o'tib ketadi va
  "Ilovani o'rnatish" tugmasi hech qachon chiqmaydi. Shuning uchun bu skript layout.tsx da
  <Script strategy="beforeInteractive"> bilan ulanadi va hodisani saqlab qo'yadi;
  components/InstallAppButton.tsx shu qiymatni o'qiydi.
*/
(function () {
  window.__appInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", function (event) {
    // Brauzerning o'z mini-bannerini to'xtatamiz — taklifni menyudagi tugma beradi
    event.preventDefault();
    window.__appInstallPrompt = event;
    window.dispatchEvent(new Event("app:installable"));
  });

  window.addEventListener("appinstalled", function () {
    window.__appInstallPrompt = null;
    window.dispatchEvent(new Event("app:installed"));
  });
})();
