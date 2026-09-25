export async function verifyFlutterwaveTransaction(secretKey:string,transactionId:string|number){
  const response=await fetch("https://api.flutterwave.com/v3/transactions/"+encodeURIComponent(String(transactionId))+"/verify",{
    headers:{Authorization:"Bearer "+secretKey,"content-type":"application/json"},
  });
  const payload=await response.json().catch(()=>null) as any;
  if(!response.ok || payload?.status!=="success" || !payload?.data) return null;
  return payload.data;
}
