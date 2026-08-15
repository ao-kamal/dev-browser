import { describe, expect, it } from "vitest";

import { parseRequest } from "./protocol.js";

describe("idle timeout protocol configuration", () => {
  it("accepts a non-negative safe integer on requests", () => {
    expect(
      parseRequest(
        JSON.stringify({
          id: "status-1",
          type: "status",
          idleTimeoutMs: 300_000,
        })
      )
    ).toEqual({
      success: true,
      request: {
        id: "status-1",
        type: "status",
        idleTimeoutMs: 300_000,
      },
    });

    expect(
      parseRequest(JSON.stringify({ id: "status-2", type: "status", idleTimeoutMs: 0 }))
    ).toEqual({
      success: true,
      request: { id: "status-2", type: "status", idleTimeoutMs: 0 },
    });
  });

  it("rejects negative or unsafe timeout values", () => {
    expect(
      parseRequest(JSON.stringify({ id: "negative", type: "status", idleTimeoutMs: -1 })).success
    ).toBe(false);
    expect(
      parseRequest(
        JSON.stringify({
          id: "unsafe",
          type: "status",
          idleTimeoutMs: Number.MAX_SAFE_INTEGER + 1,
        })
      ).success
    ).toBe(false);
  });
});

describe("execute request channel", () => {
  it("accepts chrome and msedge", () => {
    for (const channel of ["chrome", "msedge"] as const) {
      const parsed = parseRequest(
        JSON.stringify({
          id: `exec-${channel}`,
          type: "execute",
          script: "console.log(1)",
          channel,
        })
      );
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.request).toMatchObject({ channel });
      }
    }
  });

  it("rejects an unknown channel", () => {
    expect(
      parseRequest(
        JSON.stringify({
          id: "exec-bad",
          type: "execute",
          script: "console.log(1)",
          channel: "firefox",
        })
      ).success
    ).toBe(false);
  });
});
