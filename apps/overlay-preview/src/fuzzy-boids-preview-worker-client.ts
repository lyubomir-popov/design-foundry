import type { PointField, Vector3 } from "@design-foundry/core-types";
import type { FuzzyBoidsParams } from "@design-foundry/operator-fuzzy-boids";

export interface WorkerBoidsPreviewSnapshot {
  boidCount: number;
  timeSeconds: number;
  positionsPx: Float32Array;
  activeMask: Uint8Array;
}

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
type WorkerResultMessage = ResolvePreviewResultMessage;

export class FuzzyBoidsPreviewWorkerClient {
  private worker: Worker | null = null;
  private inflightRequest: ResolvePreviewRequestMessage | null = null;
  private queuedRequest: ResolvePreviewRequestMessage | null = null;
  private nextRequestId = 1;
  private latestSnapshot: WorkerBoidsPreviewSnapshot | null = null;
  private latestStructuralKey = "";
  private onUpdate: (() => void) | null = null;

  constructor() {
    if (typeof Worker === "undefined") {
      return;
    }

    try {
      this.worker = new Worker(new URL("./fuzzy-boids-preview.worker.ts", import.meta.url), { type: "module" });
      this.worker.addEventListener("message", (event: MessageEvent<WorkerResultMessage>) => {
        this.handleWorkerMessage(event.data);
      });
      this.worker.addEventListener("error", () => {
        this.dispose();
      });
    } catch {
      this.worker = null;
    }
  }

  isSupported(): boolean {
    return this.worker !== null;
  }

  setOnUpdate(callback: (() => void) | null): void {
    this.onUpdate = callback;
  }

  reset(): void {
    this.inflightRequest = null;
    this.queuedRequest = null;
    this.latestSnapshot = null;
    this.latestStructuralKey = "";
    this.postMessage({ type: "reset" });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.inflightRequest = null;
    this.queuedRequest = null;
    this.latestSnapshot = null;
    this.latestStructuralKey = "";
  }

  requestResolve(
    params: FuzzyBoidsParams,
    center: Vector3,
    seedField: PointField | null,
    structuralKey: string,
    exactKey: string
  ): WorkerBoidsPreviewSnapshot | null {
    if (!this.worker) {
      return null;
    }

    const request: ResolvePreviewRequestMessage = {
      type: "resolve",
      requestId: this.nextRequestId,
      structuralKey,
      exactKey,
      params,
      center,
      seedField
    };

    this.nextRequestId += 1;

    if (this.inflightRequest?.exactKey === exactKey) {
      return this.latestStructuralKey === structuralKey ? this.latestSnapshot : null;
    }

    if (!this.inflightRequest) {
      this.inflightRequest = request;
      this.postMessage(request);
    } else {
      this.queuedRequest = request;
    }

    return this.latestStructuralKey === structuralKey ? this.latestSnapshot : null;
  }

  private postMessage(message: WorkerRequestMessage): void {
    this.worker?.postMessage(message);
  }

  private handleWorkerMessage(message: WorkerResultMessage): void {
    if (message.type !== "resolved") {
      return;
    }

    if (this.inflightRequest?.requestId === message.requestId) {
      this.inflightRequest = null;
    }

    this.latestStructuralKey = message.structuralKey;
    this.latestSnapshot = {
      boidCount: message.boidCount,
      timeSeconds: message.timeSeconds,
      positionsPx: new Float32Array(message.positionsPxBuffer),
      activeMask: new Uint8Array(message.activeMaskBuffer)
    };

    const queuedRequest = this.queuedRequest;
    this.queuedRequest = null;
    if (queuedRequest) {
      this.inflightRequest = queuedRequest;
      this.postMessage(queuedRequest);
    }

    this.onUpdate?.();
  }
}