const WIDGET_HTML = `
<div style="position:fixed;bottom:92px;right:24px;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <a href="https://workbench.novaisystems.online/" target="_blank" rel="noopener"
     style="display:flex;align-items:center;gap:10px;padding:12px 20px;background:linear-gradient(135deg,#1a1f36,#252b45);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.4);text-decoration:none;transition:transform .2s,box-shadow .2s"
     onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px rgba(0,100,255,.25)'"
     onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(0,0,0,.4)'">
    <span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:linear-gradient(135deg,#0077ff,#00bbff);border-radius:10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    </span>
    <span style="display:flex;flex-direction:column;gap:2px">
      <strong style="font-size:14px;font-weight:700;color:#fff">WorkBench</strong>
      <small style="font-size:11px;color:rgba(255,255,255,.5)">Local Services Marketplace</small>
    </span>
  </a>
</div>`;

const SALES_AGENT_SCRIPT = `<script src="https://novaisystems.online/sales-agent.js"><\/script>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const isWorkbench = url.hostname === "workbench.novaisystems.online";
    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return res;
    return new HTMLRewriter()
      .on("body", {
        element(el) {
          // WorkBench widget only on the main site (not on workbench itself)
          if (!isWorkbench) {
            el.append(WIDGET_HTML, { html: true });
          }
          // Sales agent only on the WorkBench app
          if (isWorkbench) {
            el.append(SALES_AGENT_SCRIPT, { html: true });
          }
        }
      })
      .transform(res);
  }
};
