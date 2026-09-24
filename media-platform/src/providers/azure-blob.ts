import type { StorageProvider } from "./types";

export type AzureBlobConfig = {
  accountName: string;
  accountKey: string;
  container: string;
};

const AZURE_VERSION = "2022-11-02";
const encoder = new TextEncoder();

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

function toBase64(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function isoNoMillis(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function escapePath(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export class AzureBlobProvider implements StorageProvider {
  readonly name = "azure" as const;

  constructor(private readonly config: AzureBlobConfig) {}

  private resourceUrl(key?: string) {
    const base = `https://${this.config.accountName}.blob.core.windows.net/${encodeURIComponent(this.config.container)}`;
    return key ? `${base}/${escapePath(key)}` : base;
  }

  private async sas(input: {
    key?: string;
    permissions: string;
    resource: "b" | "c";
    expiresInSeconds: number;
  }) {
    const start = isoNoMillis(new Date(Date.now() - 5 * 60 * 1000));
    const expiry = isoNoMillis(new Date(Date.now() + input.expiresInSeconds * 1000));
    const canonical = input.key
      ? `/blob/${this.config.accountName}/${this.config.container}/${input.key}`
      : `/blob/${this.config.accountName}/${this.config.container}`;

    const stringToSign = [
      input.permissions,
      start,
      expiry,
      canonical,
      "",
      "",
      "https",
      AZURE_VERSION,
      input.resource,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join("\n");

    const key = await crypto.subtle.importKey(
      "raw",
      fromBase64(this.config.accountKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = toBase64(
      await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign)),
    );

    const query = new URLSearchParams({
      sp: input.permissions,
      st: start,
      se: expiry,
      spr: "https",
      sv: AZURE_VERSION,
      sr: input.resource,
      sig: signature,
    });
    return query.toString();
  }

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }) {
    const sas = await this.sas({
      key: input.key,
      permissions: "cw",
      resource: "b",
      expiresInSeconds: input.expiresInSeconds ?? 900,
    });
    return `${this.resourceUrl(input.key)}?${sas}`;
  }

  async createDownloadUrl(input: { key: string; expiresInSeconds?: number }) {
    const sas = await this.sas({
      key: input.key,
      permissions: "r",
      resource: "b",
      expiresInSeconds: input.expiresInSeconds ?? 300,
    });
    return `${this.resourceUrl(input.key)}?${sas}`;
  }

  async headObject(key: string) {
    const url = await this.createDownloadUrl({ key, expiresInSeconds: 120 });
    const response = await fetch(url, { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Azure HEAD failed: ${response.status}`);
    return {
      size: Number(response.headers.get("content-length") ?? 0),
      etag: response.headers.get("etag") ?? undefined,
      contentType: response.headers.get("content-type") ?? undefined,
    };
  }

  async deleteObject(key: string) {
    const sas = await this.sas({
      key,
      permissions: "d",
      resource: "b",
      expiresInSeconds: 300,
    });
    const response = await fetch(`${this.resourceUrl(key)}?${sas}`, {
      method: "DELETE",
      headers: { "x-ms-version": AZURE_VERSION },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Azure delete failed: ${response.status}`);
    }
  }

  async listObjects(prefix: string, cursor?: string) {
    const sas = await this.sas({
      permissions: "l",
      resource: "c",
      expiresInSeconds: 300,
    });
    const query = new URLSearchParams({
      restype: "container",
      comp: "list",
      prefix,
      maxresults: "100",
    });
    if (cursor) query.set("marker", cursor);

    const response = await fetch(
      `${this.resourceUrl()}?${query.toString()}&${sas}`,
      { headers: { "x-ms-version": AZURE_VERSION } },
    );
    if (!response.ok) throw new Error(`Azure list failed: ${response.status}`);
    const xml = await response.text();

    const objects = [...xml.matchAll(/<Blob>([\s\S]*?)<\/Blob>/g)].map((match) => {
      const block = match[1];
      const read = (tag: string) => {
        const found = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return found ? decodeXml(found[1]) : undefined;
      };
      const name = read("Name") ?? "";
      const size = Number(read("Content-Length") ?? 0);
      const etag = read("Etag");
      const modified = read("Last-Modified");
      return {
        key: name,
        size,
        etag,
        lastModified: modified ? new Date(modified) : undefined,
      };
    });

    const marker = xml.match(/<NextMarker>([\s\S]*?)<\/NextMarker>/)?.[1];
    return {
      objects,
      cursor: marker ? decodeXml(marker) : undefined,
    };
  }
}
