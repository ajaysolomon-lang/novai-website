(function() {
  if (document.querySelector('.novai-workbench-widget')) return;

  var container = document.createElement('div');
  container.className = 'novai-workbench-widget';

  container.innerHTML =
    '<a href="https://workbench.novaisystems.online/" target="_blank" rel="noopener">' +
      '<span class="novai-wb-icon">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>' +
      '</span>' +
      '<span class="novai-wb-text">' +
        '<strong>WorkBench</strong>' +
        '<small>Local Services Marketplace</small>' +
      '</span>' +
    '</a>';

  var style = document.createElement('style');
  style.textContent =
    '.novai-workbench-widget{position:fixed;bottom:92px;right:24px;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}' +
    '.novai-workbench-widget a{display:flex;align-items:center;gap:10px;padding:12px 20px;background:linear-gradient(135deg,#1a1f36,#252b45);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.4);text-decoration:none;transition:transform .2s,box-shadow .2s,border-color .2s}' +
    '.novai-workbench-widget a:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,100,255,.25);border-color:rgba(0,150,255,.3)}' +
    '.novai-wb-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:linear-gradient(135deg,#0077ff,#00bbff);border-radius:10px;flex-shrink:0}' +
    '.novai-wb-text{display:flex;flex-direction:column;gap:2px}' +
    '.novai-wb-text strong{font-size:14px;font-weight:700;color:#fff}' +
    '.novai-wb-text small{font-size:11px;color:rgba(255,255,255,.5);font-weight:400}' +
    '@media(max-width:480px){.novai-workbench-widget{bottom:80px;right:16px}.novai-workbench-widget a{padding:10px 14px;gap:8px}.novai-wb-text small{display:none}}';

  document.head.appendChild(style);
  document.body.appendChild(container);
})();
