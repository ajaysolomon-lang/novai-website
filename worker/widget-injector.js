const WIDGET_SCRIPT = `<script src="https://novaisystems.online/widget.js"><\/script>`;
const SALES_AGENT_SCRIPT = `<script src="https://novaisystems.online/sales-agent.js"><\/script>`;

export default {
  async fetch(request) {
    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return res;
    return new HTMLRewriter()
      .on("body", {
        element(el) {
          el.append(WIDGET_SCRIPT, { html: true });
          el.append(SALES_AGENT_SCRIPT, { html: true });
        }
      })
      .transform(res);
  }
};
