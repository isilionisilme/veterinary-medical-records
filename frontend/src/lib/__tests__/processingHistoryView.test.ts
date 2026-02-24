import {
  formatDuration,
  formatShortDate,
  formatTime,
  shouldShowDetails,
  statusIcon,
} from "../processingHistoryView";
import type { StepGroup } from "../processingHistory";
import { describe, expect, it } from "vitest";

function stepGroup(overrides: Partial<StepGroup>): StepGroup {
  return {
    step_name: "EXTRACTION",
    attempt: 1,
    status: "COMPLETED",
    start_time: "2026-02-09T23:52:00Z",
    end_time: "2026-02-09T23:52:00Z",
    raw_events: [],
    ...overrides,
  };
}

describe("processingHistoryView helpers", () => {
  it("formats short date as DD/MM/YY", () => {
    expect(formatShortDate("2026-02-09T23:52:00Z")).toBe("09/02/26");
  });

  it("formats time as HH:mm", () => {
    expect(formatTime("2026-02-09T23:52:00Z")).toBe("23:52");
  });

  it("returns <1s for short durations", () => {
    expect(formatDuration("2026-02-09T23:52:00Z", "2026-02-09T23:52:00Z")).toBe("<1s");
  });

  it("returns status icons", () => {
    expect(statusIcon("COMPLETED")).toBe("✅");
    expect(statusIcon("FAILED")).toBe("❌");
    expect(statusIcon("RUNNING")).toBe("⏳");
  });

  it("shows details only for failed or retries", () => {
    expect(shouldShowDetails(stepGroup({ status: "FAILED" }))).toBe(true);
    expect(shouldShowDetails(stepGroup({ attempt: 2 }))).toBe(true);
    expect(shouldShowDetails(stepGroup({ status: "COMPLETED", attempt: 1 }))).toBe(false);
  });
});
