import { ImageResponse } from "next/og";

export const alt="Mkety Media — managed media storage and delivery";
export const size={width:1200,height:630};
export const contentType="image/png";

export default function TwitterImage(){
  return new ImageResponse(
    <div style={{
      width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",
      background:"#09090b",color:"#f5f5f7",padding:"64px 72px",fontFamily:"Arial, sans-serif",
      backgroundImage:"radial-gradient(circle at 15% 10%, rgba(109,93,246,.30), transparent 38%), radial-gradient(circle at 85% 80%, rgba(139,92,246,.20), transparent 34%)"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:22}}>
        <img src="https://media.mkety.com/mkety-logo-purple.png" width="190" height="60" style={{objectFit:"contain"}}/>
        <div style={{fontSize:24,color:"#a4a4ad",fontWeight:600}}>MEDIA</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",maxWidth:980}}>
        <div style={{fontSize:68,lineHeight:1.05,fontWeight:800,letterSpacing:"-2px"}}>Store your media. Use it anywhere.</div>
        <div style={{fontSize:30,lineHeight:1.35,color:"#c7c7d1",marginTop:26}}>Managed image, video and file storage with fast delivery, predictable plans and custom options for business.</div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:22,color:"#a4a4ad"}}>
        <div>media.mkety.com</div>
        <div style={{color:"#9c91ff"}}>A Mkety product</div>
      </div>
    </div>,
    size,
  );
}
