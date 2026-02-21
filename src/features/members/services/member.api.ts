import { apiClient } from "@/lib/api-client";
import type { MemberService } from "./member.service";
import type { Member } from "../types";

export const apiMemberService: MemberService = {
  async getAll() { return apiClient.get<Member[]>("/admin/members"); },
  async activate(id) { return apiClient.post<Member>(`/admin/members/${id}/activate`, {}); },
  async deactivate(id) { return apiClient.post<Member>(`/admin/members/${id}/deactivate`, {}); },
};
