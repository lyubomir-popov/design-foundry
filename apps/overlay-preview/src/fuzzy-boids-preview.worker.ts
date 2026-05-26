import type { PointField, Vector3 } from "@design-foundry/core-types";
import { FuzzyBoidsSimulation, type FuzzyBoidsParams } from "@design-foundry/operator-fuzzy-boids";

interface ResolvePreviewRequestMessage {
  type: "resolve";
  requestId: number;
  structuralKey: string;
  exactKey: string;
  params: FuzzyBoidsParams;
  center: Vector3;
  seedField: PointField | null;
}

interface ResetWorkerMessage {
  type: "reset";
}

interface ResolvePreviewResultMessage {
  type: "resolved";
  requestId: number;
  structuralKey: string;
  exactKey: string;
  boidCount: number;
  timeSeconds: number;
  positionsPxBuffer: ArrayBuffer;
  activeMaskBuffer: ArrayBuffer;
}

type WorkerRequestMessage = ResolvePreviewRequestMessage | ResetWorkerMessage;

const simulation = new FuzzyBoidsSimulation();
const workerScope = globalThis as typeof globalThis & {
  postMessage: (message: unknown, transfer: Transferable[]) => void;
};

globalThis.addEventListener("message", (event: MessageEvent<WorkerRequestMessage>) => {
  const message = event.data;
  if (message.type === "reset") {
    simulation.reset();
    return;
  }

  const outputs = simulation.resolve(message.params, message.center, message.seedField);
  const boids = outputs.boidField.boids;
  const count = boids.length;
  const positionsPx = new Float32Array(count * 2);
  const activeMask = new Uint8Array(count);

  for (let index = 0; index < count; index += 1) {
    const boid = boids[index];
    const offset = index * 2;
    positionsPx[offset] = boid.position.x;
    positionsPx[offset + 1] = boid.position.y;
    activeMask[index] = Boolean(boid.attributes.boid_active) ? 1 : 0;
  }

  const response: ResolvePreviewResultMessage = {
    type: "resolved",
    requestId: message.requestId,
    structuralKey: message.structuralKey,
    exactKey: message.exactKey,
    boidCount: count,
    timeSeconds: outputs.boidField.simulation.timeSeconds,
    positionsPxBuffer: positionsPx.buffer,
    activeMaskBuffer: activeMask.buffer
  };

  workerScope.postMessage(response, [response.positionsPxBuffer, response.activeMaskBuffer]);
});