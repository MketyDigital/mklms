import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { queryD1Rows } from "../../../lib/d1-query-adapter.ts";
import type { CertificateTemplateRecord } from "./postgres-certificate.repository";
import type { CreateCertificateTemplateInput } from "./postgres-certificate-template.repository";

export class D1CertificateTemplateRepository {
  private readonly db:D1DatabaseLike;
  constructor(db:D1DatabaseLike){this.db=db;}

  async listTemplates():Promise<CertificateTemplateRecord[]>{
    const rows=await queryD1Rows<{id:string;name:string;course_id:string|null;background_asset_id:string|null;signature_asset_id:string|null;layout_config_json:string;certificate_prefix:string;active:number}>(this.db,{sql:"SELECT id,name,course_id,background_asset_id,signature_asset_id,layout_config_json,certificate_prefix,active FROM certificate_templates ORDER BY active DESC,updated_at DESC"});
    return rows.map((row)=>{let layoutConfig:Record<string,unknown>={};try{layoutConfig=JSON.parse(row.layout_config_json) as Record<string,unknown>;}catch{throw new Error("Stored certificate template layout is invalid JSON.");}return{id:row.id,name:row.name,courseId:row.course_id,backgroundAssetId:row.background_asset_id,signatureAssetId:row.signature_asset_id,certificatePrefix:row.certificate_prefix,layoutConfig,active:Boolean(row.active)};});
  }

  async createTemplate(input:CreateCertificateTemplateInput):Promise<string>{
    const id=randomUUID(),active=input.active??true;
    await this.db.batch([
      ...(active?[this.db.prepare("UPDATE certificate_templates SET active=0,updated_at=CURRENT_TIMESTAMP WHERE course_id IS ?").bind(input.courseId??null)]:[]),
      this.db.prepare("INSERT INTO certificate_templates(id,name,background_asset_id,signature_asset_id,layout_config_json,certificate_prefix,active,course_id) VALUES(?,?,?,?,?,?,?,?)").bind(id,input.name.trim(),input.backgroundAssetId??null,input.signatureAssetId??null,JSON.stringify(input.layoutConfig??{}),input.certificatePrefix?.trim()||"CERT",Number(active),input.courseId??null),
    ]);
    return id;
  }

  async setActive(id:string,active:boolean):Promise<void>{
    const target=await queryD1Rows<{course_id:string|null}>(this.db,{sql:"SELECT course_id FROM certificate_templates WHERE id=? LIMIT 1",params:[id]});
    if(!target[0])return;
    const statements=[];
    if(active)statements.push(this.db.prepare("UPDATE certificate_templates SET active=0,updated_at=CURRENT_TIMESTAMP WHERE course_id IS ?").bind(target[0].course_id));
    statements.push(this.db.prepare("UPDATE certificate_templates SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(Number(active),id));
    await this.db.batch(statements);
  }
}
