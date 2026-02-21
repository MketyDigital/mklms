import type { DashboardData } from "../types";

export interface DashboardService {
  getData(): Promise<DashboardData>;
}
