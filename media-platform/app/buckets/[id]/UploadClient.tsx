"use client";

import { useState } from "react";

type UploadTicket = {
  uploadMode: "r2-multipart" | "presigned";
  reservationId: string;
  objectId: string;
  chunkSize?: number;
  uploadUrl?: string;
  uploadHeaders?: Record<string,string>;
};

const pause = (ms:number) => new Promise<void>(resolve => setTimeout(resolve,ms));
const retryable = (status:number) => status===408 || status===429 || status>=500;

function uploadWithProgress(url:string, data:Blob, headers:Record<string,string>, onProgress:(bytes:number)=>void):Promise<string> {
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open("PUT",url);
    xhr.timeout=180000;
    xhr.withCredentials=url.startsWith("/");
    for(const [key,value] of Object.entries(headers)) xhr.setRequestHeader(key,value);
    xhr.upload.onprogress=(event)=>{ if(event.lengthComputable) onProgress(Math.min(event.loaded,data.size)); };
    xhr.onerror=()=>reject(new Error("Network connection interrupted"));
    xhr.ontimeout=()=>reject(new Error("Upload timed out on this connection"));
    xhr.onabort=()=>reject(new Error("Upload interrupted"));
    xhr.onload=()=>{
      if(xhr.status>=200 && xhr.status<300) {
        onProgress(data.size);
        resolve(xhr.responseText);
      } else {
        const error=new Error("Upload rejected ("+xhr.status+")") as Error & {status:number};
        error.status=xhr.status;
        reject(error);
      }
    };
    xhr.send(data);
  });
}

async function withRetry<T>(operation:()=>Promise<T>, onRetry:(attempt:number)=>void):Promise<T>{
  for(let attempt=0;attempt<5;attempt++){
    try { return await operation(); }
    catch(error){
      const status=(error as Error & {status?:number}).status;
      if(attempt===4 || (status!==undefined && !retryable(status))) throw error;
      onRetry(attempt+1);
      await pause(Math.min(16000,1000*2**attempt)+Math.floor(Math.random()*500));
    }
  }
  throw new Error("Upload retries exhausted");
}

export default function UploadClient({bucketId}:{bucketId:string}){
  const [status,setStatus]=useState("");
  const [progress,setProgress]=useState(0);
  const [busy,setBusy]=useState(false);
  const [saved,setSaved]=useState(false);

  async function upload(file:File){
    setBusy(true);setSaved(false);setProgress(0);setStatus("Preparing "+file.name+"...");
    let signed:UploadTicket|undefined;
    try{
      const sign=await fetch("/api/uploads/sign",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bucketId,name:file.name,size:file.size,contentType:file.type||"application/octet-stream"})});
      const response=await sign.json();
      if(!sign.ok) throw new Error(response.error||"Upload could not start");
      signed=response as UploadTicket;

      if(signed.uploadMode==="r2-multipart"){
        const parts:{partNumber:number;etag:string}[]=[];
        const chunkSize=Math.min(20*1024*1024,Math.max(5*1024*1024,Number(signed.chunkSize||20*1024*1024)));
        let confirmed=0;
        for(let offset=0;offset<file.size;offset+=chunkSize){
          const chunk=file.slice(offset,Math.min(file.size,offset+chunkSize));
          const number=parts.length+1;
          const url="/api/uploads/r2/part?reservationId="+encodeURIComponent(signed.reservationId)+"&partNumber="+number;
          const result=await withRetry(
            ()=>uploadWithProgress(url,chunk,{},bytes=>{
              setProgress(Math.min(99,Math.floor((confirmed+bytes)/file.size*100)));
              setStatus("Uploading "+file.name+" — "+Math.floor((confirmed+bytes)/1024/1024)+" / "+Math.ceil(file.size/1024/1024)+" MiB");
            }),
            attempt=>{setProgress(Math.min(99,Math.floor(confirmed/file.size*100)));setStatus("Connection interrupted. Retrying part "+number+" ("+attempt+"/4)...");}
          );
          const payload=JSON.parse(result);
          if(!payload.etag || payload.partNumber!==number) throw new Error("Storage did not acknowledge part "+number);
          parts.push({partNumber:number,etag:payload.etag});
          confirmed+=chunk.size;
        }
        setProgress(99);setStatus("Verifying and saving "+file.name+"...");
        const complete=await fetch("/api/uploads/r2/complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:signed.reservationId,objectId:signed.objectId,parts})});
        const payload=await complete.json();
        if(!complete.ok || !payload.ok) throw new Error(payload.error||"Storage confirmation failed");
      } else {
        if(!signed.uploadUrl) throw new Error("Storage upload URL missing");
        const ticket=signed;
        await withRetry(
          ()=>uploadWithProgress(ticket.uploadUrl!,file,ticket.uploadHeaders||{"content-type":file.type||"application/octet-stream"},bytes=>{
            setProgress(Math.min(99,Math.floor(bytes/file.size*100)));
            setStatus("Uploading "+file.name+" — "+Math.floor(bytes/1024/1024)+" / "+Math.ceil(file.size/1024/1024)+" MiB");
          }),
          attempt=>{setProgress(0);setStatus("Connection interrupted. Retrying upload ("+attempt+"/4)...");}
        );
        setProgress(99);setStatus("Verifying and saving "+file.name+"...");
        const finalize=await fetch("/api/uploads/finalize",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:signed.reservationId,objectId:signed.objectId})});
        const payload=await finalize.json().catch(()=>({}));
        if(!finalize.ok || !payload.ok) throw new Error(payload.error||"Storage confirmation failed");
      }
      setProgress(100);setSaved(true);setStatus("✓ "+file.name+" successfully uploaded and saved.");
    }catch(error){
      // Keep server-side reservations on uncertain completion; never delete customer data
      // merely because the final acknowledgement was lost on a slow connection.
      setSaved(false);setStatus((error instanceof Error?error.message:"Upload failed")+". Please retry or refresh the file list before uploading again.");
    }finally{setBusy(false);}
  }

  return <div className="card" style={{marginBottom:18}}>
    <strong>Upload files</strong>
    <input style={{display:"block",marginTop:12}} type="file" multiple disabled={busy} onChange={async e=>{
      const input=e.currentTarget;
      const files=Array.from(input.files||[]);
      for(const file of files) await upload(file);
      input.value="";
    }}/>
    {status&&<p role="status" aria-live="polite" className="muted" style={{color:saved?"#16a34a":undefined}}>{status}</p>}
    {busy&&<progress value={progress} max={100} aria-label="Upload progress" style={{width:"100%"}}/>}
    {(busy||progress>0)&&<p className="muted">{progress}% {progress===99?"— confirming storage":""}</p>}
    {saved&&<button type="button" onClick={()=>location.reload()}>Refresh saved files</button>}
  </div>;
}
