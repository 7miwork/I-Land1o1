(function () {
  var banner = document.getElementById('cookie-banner');
  var acceptBtn = document.getElementById('cookie-accept');
  var declineBtn = document.getElementById('cookie-decline');

  if (!banner || !acceptBtn || !declineBtn) return;

  if (localStorage.getItem('iland:cookieConsent')) {
    banner.style.display = 'none';
    return;
  }

  banner.classList.add('visible');

  acceptBtn.addEventListener('click', function () {
    localStorage.setItem('iland:cookieConsent', 'accepted');
    banner.classList.remove('visible');
    setTimeout(function () { banner.style.display = 'none'; }, 300);
  });

  declineBtn.addEventListener('click', function () {
    localStorage.setItem('iland:cookieConsent', 'declined');
    banner.classList.remove('visible');
    setTimeout(function () { banner.style.display = 'none'; }, 300);
  });
})();