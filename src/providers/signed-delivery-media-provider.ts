import { createHmac } from "node:crypto";

import type {
  MediaAsset,
  MediaProvider,
  PlaybackAuthorization,
  PlaybackAuthorizationContext,
} from "./media-provider";

export interface SignedDeliveryMediaProviderOptions {
  deliveryBaseUrl: string;
  signingSecret: string;
}

export class SignedDeliveryMediaProvider implements MediaProvider {
  private readonly deliveryBaseUrl: string;
  private readonly signingSecret: string;

  constructor(options: SignedDeliveryMediaProviderOptions) {
    this.deliveryBaseUrl = options.deliveryBaseUrl.replace(/\/+$/, "");
    this.signingSecret = options.signingSecret;
  }

  async createPlaybackAuthorization(
    asset: MediaAsset,
    context: PlaybackAuthorizationContext,
  ): Promise<PlaybackAuthorization> {
    if (!asset.providerAssetId) {
      throw new Error("Media asset is missing its provider playback reference.");
    }

    const expiresAt = new Date(
      context.now.getTime() + Math.max(1, context.ttlSeconds) * 1000,
    );
    const expiresEpoch = Math.floor(expiresAt.getTime() / 1000);
    const viewer = context.viewerId ?? context.studentId ?? "anonymous";
    const payload = [asset.id, asset.providerAssetId, viewer, expiresEpoch].join("|");
    const signature = createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("base64url");

    const encodedAssetPath = asset.providerAssetId
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const url = new URL(`${this.deliveryBaseUrl}/${encodedAssetPath}`);
    url.searchParams.set("mk_asset", asset.id);
    url.searchParams.set("mk_viewer", viewer);
    url.searchParams.set("mk_exp", String(expiresEpoch));
    url.searchParams.set("mk_sig", signature);

    return {
      playbackType: asset.sourceType === "HLS" ? "HLS" : "DIRECT",
      url: url.toString(),
      expiresAt,
      protection: "PRIVATE_AUTHORIZATION",
    };
  }
}

export function getConfiguredMediaProvider(): MediaProvider {
  const deliveryBaseUrl = process.env.MKLMS_MEDIA_DELIVERY_BASE_URL?.trim();
  const signingSecret = process.env.MKLMS_MEDIA_SIGNING_SECRET?.trim();

  if (!deliveryBaseUrl || !signingSecret) {
    throw new Error(
      "Protected media delivery is not configured. Set MKLMS_MEDIA_DELIVERY_BASE_URL and MKLMS_MEDIA_SIGNING_SECRET or provide another MediaProvider adapter.",
    );
  }

  return new SignedDeliveryMediaProvider({ deliveryBaseUrl, signingSecret });
}
