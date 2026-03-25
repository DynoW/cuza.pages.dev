/// <reference types="@cloudflare/workers-types" />

export const onRequest: PagesFunction<{ FILES: R2Bucket }> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/^\/api/, "");

  if (path === "/ping") {
    return new Response("Pong!", { status: 200 });
  }

  const fileMatch = path.match(/^\/file\/(.+)$/);
  if (fileMatch) {
    const key = fileMatch[1];
    const object = await ctx.env.FILES.get(key);
    if (!object) return new Response("Not Found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    // Ensure PDFs are served inline so Googlebot can index them
    const contentType = headers.get("Content-Type") || "";
    if (
      contentType.includes("application/pdf") ||
      key.toLowerCase().endsWith(".pdf")
    ) {
      headers.set("Content-Type", "application/pdf");
      headers.set("Content-Disposition", "inline");
      headers.set("X-Robots-Tag", "index, follow");
    }

    return new Response(object.body, { headers });
  }

  return new Response("Not Found", { status: 404 });
};
