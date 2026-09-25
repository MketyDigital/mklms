import type { MetadataRoute } from "next";

export default function manifest():MetadataRoute.Manifest{
  return {
    name:"Mkety Media",
    short_name:"Mkety Media",
    description:"Managed media storage and fast file delivery for websites, apps and business content.",
    start_url:"/",
    display:"standalone",
    background_color:"#09090b",
    theme_color:"#6D5DF6",
    icons:[
      {src:"/icon.png",sizes:"512x512",type:"image/png"},
      {src:"/apple-icon.png",sizes:"180x180",type:"image/png"},
      {src:"/favicon.ico",sizes:"any",type:"image/x-icon"},
    ],
  };
}
