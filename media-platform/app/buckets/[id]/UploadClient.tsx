"use client";

import { useState } from "react";

export default function UploadClient({bucketId}:{bucketId:string}){
  const [status,setStatus]=useState("");

  async function upload(file:File){
    setStatus("Preparing upload...");
    const sign=await fetch("/api/uploads/sign",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bucketId,name:file.name,size:file.size,contentType:file.type||"application/octet-stream"})});
    const signed:any=await sign.json();
    if(!sign.ok){setStatus(signed.error||"Upload could not start");return;}

    try{
      if(signed.uploadMode==="r2-multipart"){
        const parts:any[]=[];
        const chunkSize=Number(signed.chunkSize||20*1024*1024);
        let partNumber=1;
        for(let offset=0;offset<file.size;offset+=chunkSize){
          const chunk=file.slice(offset,Math.min(file.size,offset+chunkSize));
          setStatus("Uploading "+file.name+" — part "+partNumber+"...");
          const part=await fetch("/api/uploads/r2/part?reservationId="+encodeURIComponent(signed.reservationId)+"&partNumber="+partNumber,{method:"PUT",body:chunk});
          const payload:any=await part.json();
          if(!part.ok) throw new Error(payload.error||"Part upload failed");
          parts.push({partNumber:payload.partNumber,etag:payload.etag});
          partNumber+=1;
        }

        const complete=await fetch("/api/uploads/r2/complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:signed.reservationId,objectId:signed.objectId,parts})});
        const payload:any=await complete.json();
        if(!complete.ok) throw new Error(payload.error||"Completion failed");
      }else{
        setStatus("Uploading "+file.name+"...");
        const put=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.uploadHeaders||{"content-type":file.type||"application/octet-stream"},body:file});
        if(!put.ok) throw new Error("Upload failed");
        const finalize=await fetch("/api/uploads/finalize",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:signed.reservationId,objectId:signed.objectId})});
        if(!finalize.ok) throw new Error("Finalization failed");
      }

      setStatus("Upload complete.");
      location.reload();
    }catch(error:any){
      if(signed.uploadMode==="r2-multipart"){
        await fetch("/api/uploads/r2/abort",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:signed.reservationId})}).catch(()=>undefined);
      }
      setStatus(error?.message||"Upload failed");
    }
  }

  return <div className="card" style={{marginBottom:18}}>
    <strong>Upload files</strong>
    <input style={{display:"block",marginTop:12}} type="file" multiple onChange={async(e)=>{for(const file of Array.from(e.target.files||[])) await upload(file);}}/>
    {status&&<p className="muted">{status}</p>}
  </div>;
}
