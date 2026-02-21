import type { MemberService } from "./member.service";
import type { Member } from "../types";

const mockMembers: Member[] = [
  { id: "1", name: "Rahim Uddin", email: "rahim@example.com", telegram: "@rahim_uddin", status: "active", joinedAt: "Jan 15, 2026", expiresAt: "Apr 30, 2026" },
  { id: "2", name: "Nusrat Jahan", email: "nusrat@example.com", telegram: "@nusrat_j", status: "active", joinedAt: "Feb 1, 2026", expiresAt: "May 1, 2026" },
  { id: "3", name: "Tanvir Hassan", email: "tanvir@example.com", telegram: "@tanvir_h", status: "pending", joinedAt: "Mar 25, 2026", expiresAt: "—" },
  { id: "4", name: "Sakib Rahman", email: "sakib@example.com", telegram: "@sakib_r", status: "expired", joinedAt: "Dec 10, 2025", expiresAt: "Mar 10, 2026" },
  { id: "5", name: "Farhana Akter", email: "farhana@example.com", telegram: "@farhana_a", status: "active", joinedAt: "Jan 20, 2026", expiresAt: "Apr 20, 2026" },
  { id: "6", name: "Arif Hossain", email: "arif@example.com", telegram: "@arif_h", status: "pending", joinedAt: "Mar 28, 2026", expiresAt: "—" },
];

export const mockMemberService: MemberService = {
  async getAll() { return mockMembers; },
  async activate(id) {
    const m = mockMembers.find((m) => m.id === id);
    if (!m) throw new Error("Not found");
    m.status = "active";
    return m;
  },
  async deactivate(id) {
    const m = mockMembers.find((m) => m.id === id);
    if (!m) throw new Error("Not found");
    m.status = "expired";
    return m;
  },
};
