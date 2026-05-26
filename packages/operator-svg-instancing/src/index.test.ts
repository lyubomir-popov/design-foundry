import { describe, expect, it } from "vitest";

import type { PointField } from "@design-foundry/core-types";
import { resolveSvgInstancing } from "./index.js";

function makePointField(): PointField {
  return {
    points: [
      {
        id: "p0",
        position: { x: 10, y: 20, z: 0 },
        attributes: { pscale: 2 }
      },
      {
        id: "p1",
        position: { x: 30, y: 40, z: 0 },
        attributes: {}
      }
    ],
    detail: { source: "test" }
  };
}

describe("operator-svg-instancing", () => {
  it("creates one default svg prototype and one instance per point", () => {
    const instanceSet = resolveSvgInstancing(makePointField(), {
      defaultSvgAssetPath: "./assets/mark.svg"
    });

    expect(instanceSet.prototypes).toHaveLength(1);
    expect(instanceSet.prototypes[0]?.source).toBe("./assets/mark.svg");
    expect(instanceSet.instances).toHaveLength(2);
    expect(instanceSet.instances[0]?.scale.x).toBe(2);
    expect(instanceSet.instances[1]?.scale.x).toBe(1);
  });

  it("supports per-point prototype and asset overrides", () => {
    const field: PointField = {
      points: [
        {
          id: "a",
          position: { x: 0, y: 0, z: 0 },
          attributes: { prototype_id: "circle", svg_asset_path: "./assets/circle.svg" }
        },
        {
          id: "b",
          position: { x: 1, y: 1, z: 0 },
          attributes: { prototype_id: "square", svg_asset_path: "./assets/square.svg" }
        }
      ],
      detail: {}
    };

    const instanceSet = resolveSvgInstancing(field, {
      defaultSvgAssetPath: "./assets/default.svg"
    });

    expect(instanceSet.prototypes).toHaveLength(2);
    expect(instanceSet.prototypes.map((prototype) => prototype.id).sort()).toEqual(["circle", "square"]);
  });

  it("returns empty instances and prototypes for an empty point field", () => {
    const emptyField: PointField = { points: [], detail: {} };
    const instanceSet = resolveSvgInstancing(emptyField, {
      defaultSvgAssetPath: "./assets/mark.svg"
    });

    expect(instanceSet.prototypes).toHaveLength(0);
    expect(instanceSet.instances).toHaveLength(0);
    expect(instanceSet.detail.instance_count).toBe(0);
  });

  it("throws when a prototype id maps to different svg assets", () => {
    const field: PointField = {
      points: [
        {
          id: "a",
          position: { x: 0, y: 0, z: 0 },
          attributes: { prototype_id: "dup", svg_asset_path: "./assets/a.svg" }
        },
        {
          id: "b",
          position: { x: 1, y: 1, z: 0 },
          attributes: { prototype_id: "dup", svg_asset_path: "./assets/b.svg" }
        }
      ],
      detail: {}
    };

    expect(() => resolveSvgInstancing(field, {
      defaultSvgAssetPath: "./assets/default.svg"
    })).toThrow(/multiple SVG assets/i);
  });
});
