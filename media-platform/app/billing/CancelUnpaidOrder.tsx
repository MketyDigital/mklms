"use client";

export default function CancelUnpaidOrder({invoiceId}:{invoiceId:string}){
  function confirmCancellation(event:React.FormEvent<HTMLFormElement>){
    if(!window.confirm("Cancel this unpaid Mkety order? It will no longer activate access. If you have already completed or submitted payment, do not cancel; wait for confirmation or contact Mkety support.")){
      event.preventDefault();
    }
  }

  return <form method="post" action="/api/billing/cancel" onSubmit={confirmCancellation} style={{marginTop:12}}>
    <input type="hidden" name="invoiceId" value={invoiceId}/>
    <button className="btn secondary" type="submit">Cancel this unpaid order</button>
    <p className="muted">After cancellation, you can create a fresh order and choose a different plan or payment method. This does not reverse a payment already sent to a provider.</p>
  </form>;
}
