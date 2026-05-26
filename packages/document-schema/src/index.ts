// @design-foundry/document-schema
//
// Unit-agnostic document model shared across consumers (a4-generator print
// docs, design-foundry overlay scenes, diagram-generator diagrams via the
// JSON Schema artifact). Distilled from `A4Document` in
// `a4-generator/packages/core/src/index.ts`, with units lifted to a single
// document-level tag so individual numeric values stay primitive.

// ---------------------------------------------------------------------------
// Units & primitives
// ---------------------------------------------------------------------------

/** Tag declaring how to interpret every length number in a `Document`. */
export type LengthUnit = "pt" | "px" | "baseline";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ---------------------------------------------------------------------------
// Grid placement
// ---------------------------------------------------------------------------

/**
 * Logical placement of a node on the page grid. Independent of the resolved
 * frame; the layout engine reads this to (re)compute `Node.frame` against the
 * current `GridSpec`.
 */
export interface GridPlacement {
  columnStart: number;
  columnSpan: number;
  baselineRow: number;
  baselineSpan: number;
  /** Optional fine offset in the document's `units`. */
  offsetX?: number;
  offsetY?: number;
  /** Designer-pinned absolute dimensions in the document's `units`. */
  overrideWidth?: number;
  overrideHeight?: number;
}

/** Geometry of a page-level grid. Unit-agnostic; values use `Document.units`. */
export interface GridSpec {
  id: string;
  label?: string;
  page: CanvasSize;
  bleed: Insets;
  margin: Insets;
  baselineStep: number;
  columnCount: number;
  columnGutter: number;
  rowCount: number;
  rowGutter: number;
}

// ---------------------------------------------------------------------------
// Style tokens
// ---------------------------------------------------------------------------

export type TextAlign = "left" | "center" | "right";

export interface TextStyle {
  id: string;
  family: string;
  size: number;
  lineHeight: number;
  weight: number;
  color: string;
  textAlign?: TextAlign;
  uppercase?: boolean;
  /** Tracking expressed in the document's `units` (typically pt). */
  tracking?: number;
  spaceAfter?: number;
  /** Free-form provenance hooks for upstream style systems (InDesign etc.). */
  sourceStyleName?: string;
  sourceStyleType?: "paragraph" | "character" | "object" | "table" | "cell";
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export type AssetSource =
  | "embedded-data-uri"
  | "path"
  | "remote"
  | "template-package";

export interface Asset {
  id: string;
  mimeType: string;
  source: AssetSource;
  originalReference: string;
  byteLength?: number;
  dataUri?: string;
  path?: string;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export type NodeKind =
  | "text"
  | "image"
  | "table"
  | "rule"
  | "rectangle"
  | "group";

export interface Provenance {
  /** Identifier of the source content block this node was generated from. */
  sourceBlockId?: string;
  /** Generator that produced the node, for round-trip regeneration. */
  generator?: string;
  generatedAt?: string;
}

interface NodeBase {
  id: string;
  kind: NodeKind;
  frame: Rect;
  gridPlacement?: GridPlacement;
  locked?: boolean;
  hidden?: boolean;
  provenance?: Provenance;
}

export interface TextNode extends NodeBase {
  kind: "text";
  styleId: string;
  text: string;
}

export interface ImageNode extends NodeBase {
  kind: "image";
  assetId: string;
  fit: "cover" | "contain";
}

export interface TableNode extends NodeBase {
  kind: "table";
  rows: string[][];
  styleId: string;
}

export interface RuleNode extends NodeBase {
  kind: "rule";
  stroke: number;
  color?: string;
}

export interface RectangleNode extends NodeBase {
  kind: "rectangle";
  fillColor: string;
  strokeColor?: string;
  stroke?: number;
}

export interface GroupNode extends NodeBase {
  kind: "group";
  children: Node[];
}

export type Node =
  | TextNode
  | ImageNode
  | TableNode
  | RuleNode
  | RectangleNode
  | GroupNode;

// ---------------------------------------------------------------------------
// Pages and overrides
// ---------------------------------------------------------------------------

export interface Page {
  id: string;
  label: string;
  pageNumber: number;
  /** Optional reference to the template / pattern this page was generated from. */
  templatePatternId?: string;
  nodes: Node[];
}

export type OverrideProperty =
  | "frame"
  | "gridPlacement"
  | "text"
  | "styleId"
  | "locked"
  | "hidden";

/**
 * A designer-authored mutation applied on top of generator output. Stored as a
 * log so regeneration can replay them without losing manual intent.
 */
export interface Override {
  id: string;
  nodeId: string;
  property: OverrideProperty;
  value: unknown;
  updatedAt: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export interface DocumentMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentGeneration {
  generatedAt: string;
  generatorVersion: string;
  notes?: string[];
}

export interface Document {
  kind: "df.document";
  version: 1;
  /** Unit interpretation for every length value in this document. */
  units: LengthUnit;
  metadata: DocumentMetadata;
  grid: GridSpec;
  styles: TextStyle[];
  assets: Asset[];
  pages: Page[];
  overrides: Override[];
  generation?: DocumentGeneration;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isDocument(value: unknown): value is Document {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Document).kind === "df.document" &&
    (value as Document).version === 1
  );
}

export function isGroupNode(node: Node): node is GroupNode {
  return node.kind === "group";
}

/** Depth-first walk over a page's node tree, including group children. */
export function* walkNodes(page: Page): Generator<Node> {
  const stack: Node[] = [...page.nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    yield node;
    if (isGroupNode(node)) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i]!);
      }
    }
  }
}

export function findNodeById(page: Page, nodeId: string): Node | undefined {
  for (const node of walkNodes(page)) {
    if (node.id === nodeId) return node;
  }
  return undefined;
}
