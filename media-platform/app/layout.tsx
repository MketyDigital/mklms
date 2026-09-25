import type { Metadata, Viewport } from "next";
import "./globals.css";

const base="https://media.mkety.com";
const description="Managed media storage and fast file delivery for websites, apps, landing pages and business content.";

export const metadata:Metadata={
  metadataBase:new URL(base),
  title:{
    default:"Mkety Media — Managed Media Storage & Fast File Delivery",
    template:"%s | Mkety Media",
  },
  description,
  applicationName:"Mkety Media",
  category:"technology",
  keywords:[
    "managed media storage",
    "business file hosting",
    "image hosting",
    "video hosting",
    "media delivery",
    "object storage",
    "custom domain media hosting",
    "Mkety Media",
  ],
  authors:[{name:"Mkety",url:"https://mkety.com"}],
  creator:"Mkety",
  publisher:"Mkety",
  icons:{
    icon:[
      {url:"/favicon.ico",sizes:"any",type:"image/x-icon"},
      {url:"/icon.png",type:"image/png"},
    ],
    shortcut:"/favicon.ico",
    apple:[{url:"/apple-icon.png",type:"image/png"}],
  },
  manifest:"/manifest.webmanifest",
  openGraph:{
    type:"website",
    locale:"en_US",
    url:base,
    siteName:"Mkety Media",
    title:"Mkety Media — Managed Media Storage & Fast File Delivery",
    description,
    images:[{url:"/opengraph-image",width:1200,height:630,alt:"Mkety Media — managed media storage and delivery"}],
  },
  twitter:{
    card:"summary_large_image",
    title:"Mkety Media — Managed Media Storage & Fast File Delivery",
    description,
    images:["/twitter-image"],
  },
  robots:{
    index:true,
    follow:true,
    googleBot:{index:true,follow:true,"max-image-preview":"large","max-snippet":-1,"max-video-preview":-1},
  },
  referrer:"origin-when-cross-origin",
};

export const viewport:Viewport={
  themeColor:"#09090b",
  colorScheme:"dark",
};

const structuredData={
  "@context":"https://schema.org",
  "@graph":[
    {
      "@type":"Organization",
      "@id":"https://mkety.com/#organization",
      name:"Mkety",
      url:"https://mkety.com",
      logo:"https://media.mkety.com/icon.png",
    },
    {
      "@type":"WebSite",
      "@id":"https://media.mkety.com/#website",
      url:"https://media.mkety.com",
      name:"Mkety Media",
      publisher:{"@id":"https://mkety.com/#organization"},
    },
    {
      "@type":"SoftwareApplication",
      "@id":"https://media.mkety.com/#product",
      name:"Mkety Media",
      applicationCategory:"BusinessApplication",
      operatingSystem:"Web",
      url:"https://media.mkety.com",
      description,
      publisher:{"@id":"https://mkety.com/#organization"},
      featureList:[
        "Managed image, video and file storage",
        "Cached media delivery",
        "Usage and limit dashboard",
        "Full-library export",
        "Prepaid capacity upgrades",
        "Custom media domains on eligible custom plans",
      ],
    },
  ],
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}}/>
        {children}
      </body>
    </html>
  );
}
