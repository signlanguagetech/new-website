import siteData from "../data/siteData.json";

/**
 * @param {{
 *   type: "post",
 *   post: { title: string, description: string, image: string, author: string, date: string },
 *   url: string
 * } | {
 *   type: "website",
 *   url: string
 * }} params
 */
export default function jsonLDGenerator(params) {
  const schema =
    params.type === "post"
      ? {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": params.url,
          },
          headline: params.post.title,
          description: params.post.description,
          image: params.post.image,
          author: {
            "@type": params.post.author === siteData.title ? "Organization" : "Person",
            name: params.post.author,
          },
          datePublished: params.post.date,
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteData.title,
          description: siteData.description,
          url: import.meta.env.SITE,
        };

  return `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`;
}
