const WIDGET_HTML = `
<div style="position:fixed;bottom:92px;right:24px;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="tel:+12139433042"
     style="display:flex;align-items:center;gap:10px;padding:12px 20px;background:linear-gradient(135deg,#1a1f36,#252b45);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.4);text-decoration:none;transition:transform .2s,box-shadow .2s"
     onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px rgba(0,100,255,.25)'"
     onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0,0,0,.4)'">
    <span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:linear-gradient(135deg,#00c853,#00e676);border-radius:10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
    </span>
    <span style="display:flex;flex-direction:column;gap:2px">
      <strong style="font-size:14px;font-weight:700;color:#fff">Let's Talk</strong>
      <small style="font-size:11px;color:rgba(255,255,255,.5)">+1 (213) 943-3042</small>
    </span>
  </a>
</div>`;

const SALES_AGENT_SCRIPT = `<script src="https://novaisystems.online/sales-agent.js"><\/script>`;

export default {
  async fetch(request) {
    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return res;
    return new HTMLRewriter()
      .on("body", {
        element(el) {
          el.append(WIDGET_HTML, { html: true });
          el.append(SALES_AGENT_SCRIPT, { html: true });
        }
      })
      .transform(res);
  }
};
