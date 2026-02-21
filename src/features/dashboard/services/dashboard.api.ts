import { apiClient } from "@/lib/api-client";
import type { DashboardService } from "./dashboard.service";
import type { DashboardData } from "../types";

export const apiDashboardService: DashboardService = {
  async getData() {
    return apiClient.get<DashboardData>("/dashboard");
  },
};
