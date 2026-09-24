"use client";

import { useState } from "react";

export default function UploadClient({bucketId}:{bucketId:string}){
  const [status,setStatus]=useState("");

  async function upload(file:File){
    setStatus("Preparing upload...");
    const sign=await fetch("/api/uploads/sign",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bucketId,name:file.name,size:file.size,contentType:file.type||"application/octet-stream"})});
    const signed=await sign.json();
    if(!sign.ok){setStatus(signed.error||"Upload could not start");return;}

    setStatus("Uploading "+file.name+"...");
    const put=await fetch(signed.uploadUrl,{method:"PUT",headers:{"content-type":file.type||"application/octet-stream"},body:file});
    if(!put.ok){setStatus("Upload failed");return;}

    const finalize=await fetch("/api/uploads/finalize",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:signed.reservationId,objectId:signed.objectId})});
    if(!finalize.ok){setStatus("Uploaded, but finalization failed. Contact support.");return;}

    setStatus("Upload complete.");
    location.reload();
  }

  return <div className="card" style={{marginBottom:18}}>
    <strong>Upload files</strong>
    <input style={{display:"block",marginTop:12}} type="file" multiple onChange={async(e)=>{for(const file of Array.from(e.target.files||[])) await upload(file);}}/>
    {status && <p className="muted">{status}</p>}
  </div>;
}
