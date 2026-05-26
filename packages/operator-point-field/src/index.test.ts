import { describe, expect, it } from "vitest";

import { resolvePointField } from "./index.js";

describe("operator-point-field", () => {
  it("generates deterministic grid points for the same seed", () => {
    const first = resolvePointField({
      mode: "grid",
      pointCount: 12,
      columns: 4,
      widthPx: 300,
      heightPx: 180,
      jitterPx: 8,
      seed: 42
    });
    const second = resolvePointField({
      mode: "grid",
      pointCount: 12,
      columns: 4,
      widthPx: 300,
      heightPx: 180,
      jitterPx: 8,
      seed: 42
    });

    expect(second).toEqual(first);
  });

  it("generates requested point count for ring mode", () => {
    const field = resolvePointField({
      mode: "ring",
      pointCount: 64,
      radiusPx: 240,
      jitterPx: 0,
      seed: 7
    });

    expect(field.points).toHaveLength(64);
    expect(field.detail.generator_mode).toBe("ring");
  });

  it("applies centroid and origin offsets", () => {
    const field = resolvePointField(
      {
        mode: "grid",
        pointCount: 1,
        widthPx: 1,
        heightPx: 1,
        columns: 1,
        jitterPx: 0,
        origin: { x: 20, y: -10, z: 0 }
      },
      { x: 5, y: 15, z: 0 }
    );

    expect(field.points[0]?.position.x).toBe(25);
    expect(field.points[0]?.position.y).toBe(5);
  });
});
