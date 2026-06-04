import { describe, expect, it } from "vitest";
import {
  dashboardSectionToMonitorInterest,
  parseMonitorInterestParam,
} from "./dashboard-monitor-interest";

describe("dashboard-monitor-interest", () => {
  it("maps dashboard sections to monitor items", () => {
    expect(dashboardSectionToMonitorInterest("analytics")).toBe("usage");
    expect(dashboardSectionToMonitorInterest("logs")).toBe("logs");
    expect(dashboardSectionToMonitorInterest("healthcheck")).toBe("health");
    expect(dashboardSectionToMonitorInterest("routes")).toBeNull();
  });

  it("parses monitor-interest query param", () => {
    expect(parseMonitorInterestParam("usage")).toBe("usage");
    expect(parseMonitorInterestParam("LOGS")).toBe("logs");
    expect(parseMonitorInterestParam("nope")).toBeNull();
    expect(parseMonitorInterestParam(null)).toBeNull();
  });
});
