import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { queryD1Rows } from "../../../lib/d1-query-adapter.ts";

export interface D1AdminMediaAsset{id:string;title:string;provider:string;sourceType:string;providerAssetId?:string|null;durationSeconds?:number|null;status:string;createdAt:Date;}
export interface D1CreateAdminMediaAssetInput{title:string;provider:string;sourceType:"HLS"|"DIRECT"|"YOUTUBE"|"EXTERNAL_EMBED"|"CUSTOM";providerAssetId:string;durationSeconds?:number|null;status?:"PENDING"|"PROCESSING"|"READY"|"FAILED";}
type AssetRow={id:string;title:string;provider:string;source_type:string;provider_asset_id:string|null;duration_seconds:number|null;processing_status:string;created_at:string};
function toDate(value:string):Date{return new Date(value.includes("T")?value:`${value.replace(" ","T")}Z`);}

/** D1 asset metadata; object storage remains managed independently in R2. */
export class D1AdminMediaRepository{
  private readonly db:D1DatabaseLike;
  constructor(db:D1DatabaseLike){this.db=db;}
  async listAssets():Promise<D1AdminMediaAsset[]>{const rows=await queryD1Rows<AssetRow>(this.db,{sql:"SELECT id,title,provider,source_type,provider_asset_id,duration_seconds,processing_status,created_at FROM media_assets ORDER BY created_at DESC"});return rows.map(row=>this.mapRow(row));}
  async createAsset(input:D1CreateAdminMediaAssetInput):Promise<D1AdminMediaAsset>{const id=randomUUID();const statement=this.db.prepare("INSERT INTO media_assets(id,title,provider,source_type,provider_asset_id,duration_seconds,processing_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(id,input.title.trim(),input.provider.trim()||"custom",input.sourceType,input.providerAssetId.trim(),input.durationSeconds??null,input.status??"READY");const result=await statement.run();if(!result.success)throw new Error("D1 media asset creation failed.");const rows=await queryD1Rows<AssetRow>(this.db,{sql:"SELECT id,title,provider,source_type,provider_asset_id,duration_seconds,processing_status,created_at FROM media_assets WHERE id=?",params:[id]});if(!rows[0])throw new Error("D1 media asset creation did not persist.");return this.mapRow(rows[0]);}
  async deleteAsset(id:string):Promise<void>{const statements=[this.db.prepare("UPDATE lessons SET media_asset_id=NULL WHERE media_asset_id=?").bind(id),this.db.prepare("UPDATE live_sessions SET media_asset_id=NULL WHERE media_asset_id=?").bind(id),this.db.prepare("UPDATE certificate_templates SET background_asset_id=NULL WHERE background_asset_id=?").bind(id),this.db.prepare("UPDATE certificate_templates SET signature_asset_id=NULL WHERE signature_asset_id=?").bind(id),this.db.prepare("UPDATE media_assets SET poster_asset_id=NULL WHERE poster_asset_id=?").bind(id),this.db.prepare("DELETE FROM media_assets WHERE id=?").bind(id)];const results=await this.db.batch(statements);if(!Array.isArray(results)||results.length!==statements.length||results.some(result=>!result||typeof result!=="object"||!("success"in result)||result.success!==true))throw new Error("D1 media asset deletion failed.");}
  private mapRow(row:AssetRow):D1AdminMediaAsset{return{id:row.id,title:row.title,provider:row.provider,sourceType:row.source_type,providerAssetId:row.provider_asset_id,durationSeconds:row.duration_seconds,status:row.processing_status,createdAt:toDate(row.created_at)};}
}
