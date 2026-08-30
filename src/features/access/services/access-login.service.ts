import {
  getAccessCodeLookupHash,
  verifyAccessCode,
} from "../domain/access-code.ts";
import {
  createSessionToken,
  hashSessionToken,
} from "../domain/session.ts";
import type { AccessRepository } from "../repositories/access.repository.ts";

export interface AccessLoginServiceOptions {
  sessionTtlSeconds: number;
}

export type AccessLoginResult =
  | { ok: true; studentId: string; sessionToken: string; expiresAt: Date }
  | { ok: false; publicMessage: string };

const NEUTRAL_LOGIN_FAILURE = "We could not sign you in with that access code.";

export class AccessLoginService {
  private readonly repository: AccessRepository;
  private readonly options: AccessLoginServiceOptions;

  constructor(
    repository: AccessRepository,
    options: AccessLoginServiceOptions,
  ) {
    this.repository = repository;
    this.options = options;
  }

  async login(accessCode: string, now = new Date()): Promise<AccessLoginResult> {
    const normalized = accessCode.trim().toUpperCase();
    if (!normalized) {
      return { ok: false, publicMessage: NEUTRAL_LOGIN_FAILURE };
    }

    const credential = await this.repository.findActiveCredentialByLookupHash(
      getAccessCodeLookupHash(normalized),
    );

    if (!credential || !verifyAccessCode(normalized, credential.hash)) {
      return { ok: false, publicMessage: NEUTRAL_LOGIN_FAILURE };
    }

    const sessionToken = createSessionToken();
    const sessionHash = hashSessionToken(sessionToken).hash;
    const expiresAt = new Date(
      now.getTime() + this.options.sessionTtlSeconds * 1000,
    );

    await this.repository.createSession(credential.studentId, {
      tokenHash: sessionHash,
      expiresAt,
    });

    return {
      ok: true,
      studentId: credential.studentId,
      sessionToken,
      expiresAt,
    };
  }

  async logout(sessionToken: string): Promise<void> {
    const tokenHash = hashSessionToken(sessionToken).hash;
    await this.repository.revokeSession(tokenHash);
  }
}
