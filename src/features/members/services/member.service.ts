import type { Member } from "../types";

export interface MemberService {
  getAll(): Promise<Member[]>;
  activate(id: string): Promise<Member>;
  deactivate(id: string): Promise<Member>;
}
