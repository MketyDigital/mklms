import type { MetadataRoute } from "next";

export default function robots():MetadataRoute.Robots{
  return {
    rules:[
      {
        userAgent:"*",
        allow:["/","/enterprise","/trust"],
        disallow:[
          "/api/",
          "/operator/",
          "/dashboard",
          "/billing",
          "/buckets",
          "/team",
          "/domains",
          "/export",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap:"https://media.mkety.com/sitemap.xml",
    host:"https://media.mkety.com",
  };
}
