import { groupProcessingSteps, type RawStepEvent } from "../processingHistory";
import { describe, expect, it } from "vitest";

function event(overrides: Partial<RawStepEvent>): RawStepEvent {
  return {
    step_name: "EXTRACTION",
    step_status: "RUNNING",
    attempt: 1,
    started_at: "2026-02-01T10:00:00Z",
    ended_at: null,
    error_code: null,
    ...overrides,
  };
}

describe("groupProcessingSteps", () => {
  it("consolidates start and end events into a single row", () => {
    const events = [
      event({ step_status: "RUNNING", started_at: "2026-02-01T10:00:00Z" }),
      event({
        step_status: "SUCCEEDED",
        started_at: "2026-02-01T10:00:01Z",
        ended_at: "2026-02-01T10:00:02Z",
      }),
    ];

    const groups = groupProcessingSteps(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe("COMPLETED");
    expect(groups[0].start_time).toBe("2026-02-01T10:00:00.000Z");
    expect(groups[0].end_time).toBe("2026-02-01T10:00:02.000Z");
  });

  it("marks running when only a start event exists", () => {
    const groups = groupProcessingSteps([
      event({ step_status: "RUNNING", started_at: "2026-02-01T10:00:00Z" }),
    ]);
    expect(groups[0].status).toBe("RUNNING");
    expect(groups[0].end_time).toBeNull();
  });

  it("marks failed when any failure event exists", () => {
    const groups = groupProcessingSteps([
      event({ step_status: "RUNNING" }),
      event({ step_status: "FAILED", ended_at: "2026-02-01T10:00:03Z" }),
    ]);
    expect(groups[0].status).toBe("FAILED");
    expect(groups[0].end_time).toBe("2026-02-01T10:00:03.000Z");
  });

  it("falls back to ended_at when started_at is missing", () => {
    const groups = groupProcessingSteps([
      event({
        step_status: "SUCCEEDED",
        started_at: null,
        ended_at: "2026-02-01T10:00:05Z",
      }),
    ]);
    expect(groups[0].status).toBe("COMPLETED");
    expect(groups[0].start_time).toBe("2026-02-01T10:00:05.000Z");
    expect(groups[0].end_time).toBe("2026-02-01T10:00:05.000Z");
  });

  it("keeps multiple attempts separate", () => {
    const groups = groupProcessingSteps([
      event({ attempt: 1, started_at: "2026-02-01T10:00:00Z" }),
      event({ attempt: 2, started_at: "2026-02-01T10:01:00Z" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].attempt).toBe(1);
    expect(groups[1].attempt).toBe(2);
  });
});
