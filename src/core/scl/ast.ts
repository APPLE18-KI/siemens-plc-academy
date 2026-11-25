import type { SclBlockKind, SclDiagnostic } from './types';

export type TokenType =
  | 'NUMBER'
  | 'TIME'
  | 'BOOL'
  | 'STRING'
  | 'IDENT'
  | 'QUOTED_TAG'
  | 'LOCAL_VAR'
  | 'DIRECT_ADDR'
  // Control flow & block keywords
  | 'IF'
  | 'THEN'
  | 'ELSIF'
  | 'ELSE'
  | 'END_IF'
  | 'CASE'
  | 'OF'
  | 'END_CASE'
  | 'FOR'
  | 'TO'
  | 'BY'
  | 'DO'
  | 'END_FOR'
  | 'WHILE'
  | 'END_WHILE'
  | 'REPEAT'
  | 'UNTIL'
  | 'END_REPEAT'
  | 'EXIT'
  | 'RETURN'
  | 'CONTINUE'
  | 'REGION'
  | 'END_REGION'
  // Optional TIA Portal declaration keywords
  | 'VAR_SECTION'
  | 'END_VAR'
  | 'BEGIN'
  | 'BLOCK_HEADER'
  | 'END_BLOCK'
  // Logical / arithmetic keywords
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'NOT'
  | 'MOD'
  // Operators & punctuation
  | 'ASSIGN' // :=
  | 'OUT_ARROW' // =>
  | 'RANGE' // ..
  | 'NEQ' // <>
  | 'LTE' // <=
  | 'GTE' // >=
  | 'EQ' // =
  | 'LT' // <
  | 'GT' // >
  | 'PLUS' // +
  | 'MINUS' // -
  | 'STAR' // *
  | 'SLASH' // /
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'LBRACKET' // [
  | 'RBRACKET' // ]
  | 'COMMA' // ,
  | 'SEMI' // ;
  | 'COLON' // :
  | 'DOT' // .
  // C-style mistakes caught for beginner diagnostics
  | 'DOUBLE_EQ' // ==
  | 'BANG_EQ' // !=
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
  numValue?: number;
  boolValue?: boolean;
  isTime?: boolean;
  regionTitle?: string;
}

export interface SourceLoc {
  line: number;
  col: number;
}

// ─── Expressions ─────────────────────────────────────────────────────────────

export type ExprNode =
  | LiteralExpr
  | VarRefExpr
  | MemberExpr
  | UnaryExpr
  | BinaryExpr
  | CallExpr;

export interface LiteralExpr extends SourceLoc {
  kind: 'Literal';
  value: boolean | number;
  isTime?: boolean;
  raw: string;
}

export type VarRefStyle = 'quoted' | 'local' | 'direct' | 'plain';

export interface VarRefExpr extends SourceLoc {
  kind: 'VarRef';
  /** Raw text as written, e.g. "Start_PB", #statStep, %I0.0, statStep */
  raw: string;
  /** Unquoted / normalized identifier name (without surrounding quotes; keeps # for local, % for direct) */
  name: string;
  style: VarRefStyle;
}

export interface MemberExpr extends SourceLoc {
  kind: 'Member';
  object: VarRefExpr | MemberExpr;
  property: string;
}

export type UnaryOp = 'NOT' | '-' | '+';

export interface UnaryExpr extends SourceLoc {
  kind: 'Unary';
  op: UnaryOp;
  operand: ExprNode;
}

export type BinaryOp =
  | 'OR'
  | 'XOR'
  | 'AND'
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | 'MOD';

export interface BinaryExpr extends SourceLoc {
  kind: 'Binary';
  op: BinaryOp;
  left: ExprNode;
  right: ExprNode;
}

export interface CallArg extends SourceLoc {
  /** Parameter name for named args (e.g. MIN, VALUE, IN, PT, Q), undefined for positional */
  name?: string;
  /** 'in' for `:=` or positional, 'out' for `=>` */
  direction: 'in' | 'out';
  expr: ExprNode;
}

export interface CallExpr extends SourceLoc {
  kind: 'Call';
  callee: string;
  /** Present if called as `#ton1.TON(...)` or `#inst(...)` */
  target?: VarRefExpr | MemberExpr;
  args: CallArg[];
}

export type AssignTarget = VarRefExpr | MemberExpr;

// ─── Statements ──────────────────────────────────────────────────────────────

export type StmtNode =
  | AssignStmt
  | CallStmt
  | IfStmt
  | CaseStmt
  | ForStmt
  | WhileStmt
  | RepeatStmt
  | RegionStmt
  | ExitStmt
  | ReturnStmt
  | ContinueStmt;

export interface AssignStmt extends SourceLoc {
  kind: 'Assign';
  target: AssignTarget;
  value: ExprNode;
}

export interface CallStmt extends SourceLoc {
  kind: 'CallStmt';
  /** Instance or function target, e.g. `#ton1`, `#ton1.TON`, `"IEC_Timer_0_DB".TON`, `TON` */
  target: VarRefExpr | MemberExpr;
  args: CallArg[];
}

export interface IfBranch extends SourceLoc {
  condition: ExprNode;
  body: StmtNode[];
}

export interface IfStmt extends SourceLoc {
  kind: 'If';
  branches: IfBranch[];
  elseBody: StmtNode[];
  elseLine?: number;
}

export interface CaseMatcher {
  low: number;
  high?: number;
}

export interface CaseBranch extends SourceLoc {
  matchers: CaseMatcher[];
  body: StmtNode[];
}

export interface CaseStmt extends SourceLoc {
  kind: 'Case';
  discriminant: ExprNode;
  branches: CaseBranch[];
  elseBody: StmtNode[];
  elseLine?: number;
}

export interface ForStmt extends SourceLoc {
  kind: 'For';
  iterator: VarRefExpr;
  from: ExprNode;
  to: ExprNode;
  by?: ExprNode;
  body: StmtNode[];
}

export interface WhileStmt extends SourceLoc {
  kind: 'While';
  condition: ExprNode;
  body: StmtNode[];
}

export interface RepeatStmt extends SourceLoc {
  kind: 'Repeat';
  body: StmtNode[];
  until: ExprNode;
}

export interface RegionStmt extends SourceLoc {
  kind: 'Region';
  title: string;
  body: StmtNode[];
}

export interface ExitStmt extends SourceLoc {
  kind: 'Exit';
}

export interface ReturnStmt extends SourceLoc {
  kind: 'Return';
}

export interface ContinueStmt extends SourceLoc {
  kind: 'Continue';
}

export interface VarDeclInfo {
  name: string;
  typeName: string;
  blockKind?: SclBlockKind;
  initExpr?: ExprNode;
  line: number;
}

export interface CompiledSclProgram {
  statements: StmtNode[];
  declarations: Record<string, VarDeclInfo>;
  diagnostics: SclDiagnostic[];
  referencedTags: string[];
  /** All executable statement lines for pre-seeding lineTelemetry with executed=false */
  executableLines: number[];
}

export function formatTargetDisplay(target: AssignTarget): string {
  if (target.kind === 'VarRef') {
    return target.raw;
  }
  return `${formatTargetDisplay(target.object)}.${target.property}`;
}
