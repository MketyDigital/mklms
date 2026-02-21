import type { DashboardService } from "./services/dashboard.service";
import { mockDashboardService } from "./services/dashboard.mock";
import { apiDashboardService } from "./services/dashboard.api";

export const dashboardService: DashboardService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockDashboardService
    : apiDashboardService;

export * from "./types";
export type { DashboardService } from "./services/dashboard.service";
