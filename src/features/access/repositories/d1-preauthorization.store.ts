import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { queryD1Rows, executeD1 } from "../../../lib/d1-query-adapter.ts";

export interface D1PreauthorizationRecord {
 id:string;email:string|null;phone:string|null;name_hint:string|null;
 course_id:string|null;status:string;claim_strategy:string;claim_code_hash:string|null;
 claim_requested_at:string|null;manual_approved_at:string|null;
}
/** Dedicated D1 preauthorization operations. Claim finalization must be
 * completed in one separately verified transaction with student creation. */
export class D1PreauthorizationStore {
 private readonly db:D1DatabaseLike;
 constructor(db:D1DatabaseLike){this.db=db;}
 async findUnclaimed(identity:{email?:string|null;phone?:string|null}):Promise<D1PreauthorizationRecord|null>{
  const email=identity.email?.trim().toLowerCase()||null;
  const phone=identity.phone?.replace(/\D/g,"")||null;
  if(!email&&!phone)return null;
  const rows=await queryD1Rows<D1PreauthorizationRecord>(this.db,{
   sql:`SELECT id,email,phone,name_hint,course_id,status,claim_strategy,
     claim_code_hash,claim_requested_at,manual_approved_at
     FROM preauthorizations WHERE status='PREAUTHORIZED' AND
     ((? IS NOT NULL AND LOWER(email)=?) OR (? IS NOT NULL AND phone=?))
     ORDER BY created_at ASC LIMIT 1`,params:[email,email,phone,phone]
  });
  return rows[0]??null;
 }
 async markClaimRequested(id:string):Promise<number>{
  if(!id)throw new Error("Preauthorization ID required");
  return executeD1(this.db,{sql:`UPDATE preauthorizations
    SET claim_requested_at=COALESCE(claim_requested_at,CURRENT_TIMESTAMP),
    updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PREAUTHORIZED'`,params:[id]});
 }
}
