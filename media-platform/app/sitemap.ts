import type { MetadataRoute } from "next";

export default function sitemap():MetadataRoute.Sitemap{
  const now=new Date();
  return [
    {url:"https://media.mkety.com/",lastModified:now,changeFrequency:"weekly",priority:1},
    {url:"https://media.mkety.com/enterprise",lastModified:now,changeFrequency:"monthly",priority:.8},
    {url:"https://media.mkety.com/trust",lastModified:now,changeFrequency:"monthly",priority:.8},
  ];
}
