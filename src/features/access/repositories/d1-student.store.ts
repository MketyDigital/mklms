import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";

export type D1StudentRecord = {
  id: string;display_name: string;email: string|null;phone: string|null;
  certificate_name: string;certificate_email: string|null;
};
export type D1StudentCreation = Omit<D1StudentRecord,"id">;

/** D1 access student storage; non-production until full AccessRepository is ported. */
export class D1StudentStore {
  private readonly db: D1DatabaseLike;
  constructor(db:D1DatabaseLike){this.db=db;}
  async create(input:D1StudentCreation):Promise<D1StudentRecord>{
    if(!input.display_name.trim()||!input.certificate_name.trim())
      throw new Error("Student name and certificate identity required");
    const id=randomUUID();
    const email=input.email?.trim().toLowerCase()||null;
    const phone=input.phone?.replace(/\D/g,"")||null;
    await executeD1(this.db,{
      sql:`INSERT INTO students(id,display_name,email,phone,certificate_name,
        certificate_email,certificate_identity_locked_at)
        VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
      params:[id,input.display_name,email,phone,input.certificate_name,
        input.certificate_email?.trim().toLowerCase()||null]
    });
    return {id,display_name:input.display_name,email,phone,
      certificate_name:input.certificate_name,
      certificate_email:input.certificate_email?.trim().toLowerCase()||null};
  }
  async findActiveById(id:string):Promise<D1StudentRecord|null>{
    if(!id)throw new Error("Student ID required");
    const rows=await queryD1Rows<D1StudentRecord>(this.db,{
      sql:`SELECT id,display_name,email,phone,certificate_name,certificate_email
        FROM students WHERE id=? AND status='ACTIVE' LIMIT 1`,params:[id]
    });
    return rows[0]??null;
  }
}
