(function() {
  if (document.querySelector('.novai-call-widget')) return;

  var container = document.createElement('div');
  container.className = 'novai-call-widget';

  container.innerHTML =
    '<a href="tel:+12139433042">' +
      '<span class="novai-cw-icon">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>' +
      '</span>' +
      '<span class="novai-cw-text">' +
        "<strong>Let's Talk</strong>" +
        '<small>+1 (213) 943-3042</small>' +
      '</span>' +
    '</a>';

  var style = document.createElement('style');
  style.textContent =
    '.novai-call-widget{position:fixed;bottom:92px;right:24px;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}' +
    '.novai-call-widget a{display:flex;align-items:center;gap:10px;padding:12px 20px;background:linear-gradient(135deg,#1a1f36,#252b45);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.4);text-decoration:none;transition:transform .2s,box-shadow .2s,border-color .2s}' +
    '.novai-call-widget a:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,100,255,.25);border-color:rgba(0,150,255,.3)}' +
    '.novai-cw-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:linear-gradient(135deg,#00c853,#00e676);border-radius:10px;flex-shrink:0}' +
    '.novai-cw-text{display:flex;flex-direction:column;gap:2px}' +
    '.novai-cw-text strong{font-size:14px;font-weight:700;color:#fff}' +
    '.novai-cw-text small{font-size:11px;color:rgba(255,255,255,.5);font-weight:400}' +
    '@media(max-width:480px){.novai-call-widget{bottom:80px;right:16px}.novai-call-widget a{padding:10px 14px;gap:8px}.novai-cw-text small{display:none}}';

  document.head.appendChild(style);
  document.body.appendChild(container);
})();
