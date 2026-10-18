// Tiny classic script that runs before the 3D bundle: localized loading text, WebGL check, load-failure message,
// and the service worker that caches the immutable versioned assets for fast repeat launches inside Telegram.
(function () {
  var q = new URLSearchParams(location.search), tg = window.Telegram && window.Telegram.WebApp;
  var code = (q.get('lang') || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || 'en').slice(0, 2);
  var ru = code === 'ru' || code === 'uk' || code === 'be' || code === 'kk';
  var txt = document.getElementById('loadtxt'), err = document.getElementById('loaderr'), box = document.getElementById('loading');
  if (ru) { txt.textContent = 'ЗАГРУЗКА БАЗЫ «АЛЬФА»…'; err.textContent = 'WebGL недоступен или загрузка не удалась. Закройте и откройте игру снова.'; }
  var gl = null; try { var c = document.createElement('canvas'); gl = c.getContext('webgl2') || c.getContext('webgl'); } catch (e) { }
  var fail = function () { box.classList.add('failed'); box.style.display = 'flex'; };
  if (!gl) fail();
  window.addEventListener('error', function (e) { if (!window.MK || !window.MK.ready) { if (e && e.target && (e.target.tagName === 'SCRIPT')) fail(); } }, true);
  setTimeout(function () { if (!window.MK || !window.MK.ready) { var b = document.getElementById('loadbar'); if (b && parseFloat(b.style.width || '0') < 20) b.style.width = '20%'; } }, 1200);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && q.get('sw') !== '0') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () { }); });
  }
})();
