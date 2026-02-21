import type { MemberService } from "./services/member.service";
import { mockMemberService } from "./services/member.mock";
import { apiMemberService } from "./services/member.api";

export const memberService: MemberService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockMemberService
    : apiMemberService;

export * from "./types";
export type { MemberService } from "./services/member.service";
