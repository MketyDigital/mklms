export function formatUsd(value:number|string){
  return "$"+Number(value||0).toFixed(2);
}
