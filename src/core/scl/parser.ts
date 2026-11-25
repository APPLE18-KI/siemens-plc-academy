import type { TagDef } from '../../types/plc';
import {
  formatTargetDisplay,
  type AssignTarget,
  type BinaryOp,
  type CallArg,
  type CaseBranch,
  type CaseMatcher,
  type CompiledSclProgram,
  type ExprNode,
  type IfBranch,
  type MemberExpr,
  type StmtNode,
  type Token,
  type TokenType,
  type VarDeclInfo,
  type VarRefExpr,
} from './ast';
import { lexScl, normalizeDirectAddress } from './lexer';
import type { SclBlockKind, SclDiagnostic } from './types';

export const BUILTIN_FC_NAMES = new Set([
  'NORM_X',
  'SCALE_X',
  'LIMIT',
  'MIN',
  'MAX',
  'ABS',
  'SQRT',
  'SQR',
  'INT_TO_REAL',
  'REAL_TO_INT',
  'DINT_TO_REAL',
  'REAL_TO_DINT',
  'INT_TO_DINT',
  'DINT_TO_INT',
  'BOOL_TO_INT',
  'INT_TO_BOOL',
  'TIME_TO_DINT',
  'DINT_TO_TIME',
  'TRUNC',
  'ROUND',
  'SEL',
]);

export const BUILTIN_FB_TYPES: Record<string, SclBlockKind> = {
  TON: 'TON',
  TON_TIME: 'TON',
  IEC_TIMER: 'TON',
  TOF: 'TOF',
  TOF_TIME: 'TOF',
  TP: 'TP',
  TP_TIME: 'TP',
  CTU: 'CTU',
  CTU_INT: 'CTU',
  CTU_DINT: 'CTU',
  IEC_COUNTER: 'CTU',
  CTD: 'CTD',
  CTD_INT: 'CTD',
  CTD_DINT: 'CTD',
  R_TRIG: 'R_TRIG',
  P_TRIG: 'R_TRIG',
  F_TRIG: 'F_TRIG',
  N_TRIG: 'F_TRIG',
};

const BLOCK_END_TOKENS = new Set<TokenType>([
  'ELSIF',
  'ELSE',
  'END_IF',
  'END_CASE',
  'END_FOR',
  'END_WHILE',
  'UNTIL',
  'END_REPEAT',
  'END_REGION',
  'END_VAR',
  'END_BLOCK',
  'EOF',
]);

class SclParser {
  private tokens: Token[];
  private pos = 0;
  public diagnostics: SclDiagnostic[];
  public declarations: Record<string, VarDeclInfo> = {};

  constructor(tokens: Token[], lexDiagnostics: SclDiagnostic[]) {
    this.tokens = tokens;
    this.diagnostics = [...lexDiagnostics];
  }

  private peek(offset = 0): Token {
    const idx = this.pos + offset;
    return idx < this.tokens.length ? this.tokens[idx] : this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const tok = this.peek();
    if (this.pos < this.tokens.length - 1) {
      this.pos += 1;
    }
    return tok;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): Token | null {
    const cur = this.peek();
    if (types.includes(cur.type)) {
      return this.advance();
    }
    return null;
  }

  private error(tok: Token, message: string, hint?: string): void {
    this.diagnostics.push({
      line: tok.line,
      col: tok.col,
      severity: 'error',
      message,
      hint,
    });
  }

  private synchronize(): void {
    while (!this.check('EOF')) {
      const t = this.peek().type;
      if (t === 'SEMI') {
        this.advance();
        return;
      }
      if (
        BLOCK_END_TOKENS.has(t) ||
        t === 'IF' ||
        t === 'CASE' ||
        t === 'FOR' ||
        t === 'WHILE' ||
        t === 'REPEAT' ||
        t === 'REGION' ||
        t === 'RETURN' ||
        t === 'EXIT'
      ) {
        return;
      }
      this.advance();
    }
  }

  private expectSemi(contextLine: number): void {
    if (this.match('SEMI')) return;
    const cur = this.peek();
    this.error(
      { ...cur, line: contextLine },
      `第 ${contextLine} 行: 语句末尾缺少分号 ';'`,
      '西门子 SCL 每条赋值、函数调用或跳转语句必须以英文分号 ";" 结尾'
    );
  }

  public parseProgram(): StmtNode[] {
    const stmts: StmtNode[] = [];

    while (!this.check('EOF')) {
      if (this.match('SEMI')) continue;

      // Gracefully skip optional TIA Portal block headers & VAR declaration sections
      if (this.check('BLOCK_HEADER')) {
        this.skipBlockHeader();
        continue;
      }
      if (this.check('VAR_SECTION')) {
        this.parseVarSection();
        continue;
      }
      if (this.match('BEGIN') || this.match('END_BLOCK')) {
        this.match('SEMI');
        continue;
      }
      // Handle TIA Portal metadata lines like `VERSION : 0.1` or `TITLE = ...`
      if (this.check('IDENT')) {
        const up = this.peek().value.toUpperCase();
        if (up === 'VERSION' && this.peek(1).type === 'COLON') {
          this.skipToNextLine(this.peek().line);
          continue;
        }
        if (up === 'TITLE' && (this.peek(1).type === 'EQ' || this.peek(1).type === 'COLON')) {
          this.skipToNextLine(this.peek().line);
          continue;
        }
      }

      const stmt = this.parseStatement();
      if (stmt) {
        stmts.push(stmt);
      }
    }

    return stmts;
  }

  private skipToNextLine(lineNo: number): void {
    while (!this.check('EOF') && this.peek().line === lineNo) {
      this.advance();
    }
  }

  private skipBlockHeader(): void {
    const headerLine = this.advance().line;
    // Skip block name, optional return type (`: Void` / `: Real`), on the same header line
    this.skipToNextLine(headerLine);
  }

  private parseVarSection(): void {
    this.advance(); // consume VAR / VAR_INPUT / VAR_STAT / etc.
    // Optional RETAIN / NON_RETAIN qualifier
    if (this.check('IDENT')) {
      const q = this.peek().value.toUpperCase();
      if (q === 'RETAIN' || q === 'NON_RETAIN' || q === 'CONSTANT') {
        this.advance();
      }
    }

    while (!this.check('EOF') && !this.check('END_VAR')) {
      if (this.match('SEMI')) continue;
      if (this.check('IDENT') || this.check('LOCAL_VAR') || this.check('QUOTED_TAG')) {
        const nameTok = this.advance();
        const varName = nameTok.type === 'LOCAL_VAR' ? nameTok.value.slice(1) : nameTok.value;
        if (!this.match('COLON')) {
          this.synchronize();
          continue;
        }
        // Parse type name (e.g. Int, Real, Bool, Time, TON, IEC_TIMER, Array[...] of ...)
        let typeName = '';
        if (this.check('IDENT') || this.check('QUOTED_TAG')) {
          typeName = this.advance().value;
        }
        // Skip any array/string brackets or `OF <type>`
        while (
          !this.check('EOF') &&
          !this.check('SEMI') &&
          !this.check('ASSIGN') &&
          !this.check('END_VAR')
        ) {
          this.advance();
        }
        let initExpr: ExprNode | undefined;
        if (this.match('ASSIGN')) {
          initExpr = this.parseExpression();
        }
        this.match('SEMI');

        const upperType = typeName.toUpperCase();
        this.declarations[varName.toLowerCase()] = {
          name: varName,
          typeName,
          blockKind: BUILTIN_FB_TYPES[upperType],
          initExpr,
          line: nameTok.line,
        };
      } else {
        this.advance();
      }
    }

    if (this.check('END_VAR')) {
      this.advance();
      this.match('SEMI');
    }
  }

  private parseStatementList(stopPredicate: () => boolean): StmtNode[] {
    const stmts: StmtNode[] = [];
    while (!this.check('EOF') && !stopPredicate()) {
      if (this.match('SEMI')) continue;
      const before = this.pos;
      const stmt = this.parseStatement();
      if (stmt) {
        stmts.push(stmt);
      } else if (this.pos === before) {
        // Safety guard against infinite loops on unexpected tokens
        this.advance();
      }
    }
    return stmts;
  }

  private parseStatement(): StmtNode | null {
    const tok = this.peek();

    switch (tok.type) {
      case 'REGION':
        return this.parseRegion();
      case 'IF':
        return this.parseIf();
      case 'CASE':
        return this.parseCase();
      case 'FOR':
        return this.parseFor();
      case 'WHILE':
        return this.parseWhile();
      case 'REPEAT':
        return this.parseRepeat();
      case 'EXIT': {
        this.advance();
        this.expectSemi(tok.line);
        return { kind: 'Exit', line: tok.line, col: tok.col };
      }
      case 'RETURN': {
        this.advance();
        this.expectSemi(tok.line);
        return { kind: 'Return', line: tok.line, col: tok.col };
      }
      case 'CONTINUE': {
        this.advance();
        this.expectSemi(tok.line);
        return { kind: 'Continue', line: tok.line, col: tok.col };
      }
      case 'QUOTED_TAG':
      case 'LOCAL_VAR':
      case 'DIRECT_ADDR':
      case 'IDENT':
        return this.parseAssignOrCall();
      case 'END_IF':
      case 'ELSIF':
      case 'ELSE':
      case 'END_CASE':
      case 'END_FOR':
      case 'END_WHILE':
      case 'END_REPEAT':
      case 'END_REGION':
        this.error(
          tok,
          `第 ${tok.line} 行: 多余或不匹配的关键字 '${tok.value}'`,
          `请检查前面是否缺少对应的起始块或多余了 '${tok.value}'`
        );
        this.advance();
        this.match('SEMI');
        return null;
      default:
        this.error(
          tok,
          `第 ${tok.line} 行: 语句起始位置出现意外符号 '${tok.value || tok.type}'`,
          'SCL 语句应以变量赋值（如 "KM1_Motor" := TRUE;）、功能块调用或控制关键字（IF / CASE / FOR / REGION）开头'
        );
        this.advance();
        this.synchronize();
        return null;
    }
  }

  private parseRegion(): StmtNode {
    const startTok = this.advance(); // REGION
    const body = this.parseStatementList(() => this.check('END_REGION') || this.check('END_BLOCK'));
    if (!this.match('END_REGION')) {
      this.error(
        startTok,
        `第 ${startTok.line} 行: REGION 折叠块未闭合，缺少 'END_REGION'`,
        '请在折叠块末尾添加 END_REGION'
      );
    } else {
      this.match('SEMI');
    }
    return {
      kind: 'Region',
      title: startTok.regionTitle ?? '',
      body,
      line: startTok.line,
      col: startTok.col,
    };
  }

  private parseIf(): StmtNode {
    const ifTok = this.advance(); // IF
    const branches: IfBranch[] = [];

    const firstCond = this.parseExpression();
    if (!this.match('THEN')) {
      const cur = this.peek();
      this.error(
        cur,
        `第 ${ifTok.line} 行: IF 条件后缺少关键字 'THEN'`,
        '正确语法：IF 条件 THEN ... END_IF;'
      );
    }

    const firstBody = this.parseStatementList(
      () => this.check('ELSIF') || this.check('ELSE') || this.check('END_IF') || this.check('END_REGION')
    );
    branches.push({
      condition: firstCond,
      body: firstBody,
      line: ifTok.line,
      col: ifTok.col,
    });

    while (this.check('ELSIF')) {
      const elsifTok = this.advance();
      const cond = this.parseExpression();
      if (!this.match('THEN')) {
        const cur = this.peek();
        this.error(
          cur,
          `第 ${elsifTok.line} 行: ELSIF 条件后缺少关键字 'THEN'`,
          '正确语法：ELSIF 条件 THEN ...'
        );
      }
      const body = this.parseStatementList(
        () => this.check('ELSIF') || this.check('ELSE') || this.check('END_IF') || this.check('END_REGION')
      );
      branches.push({
        condition: cond,
        body,
        line: elsifTok.line,
        col: elsifTok.col,
      });
    }

    let elseBody: StmtNode[] = [];
    let elseLine: number | undefined;
    if (this.check('ELSE')) {
      const elseTok = this.advance();
      elseLine = elseTok.line;
      elseBody = this.parseStatementList(() => this.check('END_IF') || this.check('END_REGION'));
    }

    if (!this.match('END_IF')) {
      this.error(
        ifTok,
        `第 ${ifTok.line} 行: IF 语句未闭合，缺少 'END_IF;'`,
        '请在条件分支结束处添加 END_IF;'
      );
    } else {
      this.match('SEMI');
    }

    return {
      kind: 'If',
      branches,
      elseBody,
      elseLine,
      line: ifTok.line,
      col: ifTok.col,
    };
  }

  private isCaseLabelStart(): boolean {
    let offset = 0;
    if (this.peek(offset).type === 'MINUS' || this.peek(offset).type === 'PLUS') {
      offset += 1;
    }
    const lit = this.peek(offset);
    if (lit.type !== 'NUMBER' && lit.type !== 'TIME') {
      return false;
    }
    const after = this.peek(offset + 1);
    return after.type === 'COLON' || after.type === 'COMMA' || after.type === 'RANGE';
  }

  private parseCaseInt(): number {
    let sign = 1;
    if (this.match('MINUS')) {
      sign = -1;
    } else {
      this.match('PLUS');
    }
    const tok = this.peek();
    if (tok.type === 'NUMBER' || tok.type === 'TIME') {
      this.advance();
      return sign * (tok.numValue ?? 0);
    }
    this.error(
      tok,
      `第 ${tok.line} 行: CASE 分支标签必须为整数常量`,
      '示例：0: 或 10, 20: 或 30..40:'
    );
    return 0;
  }

  private parseCase(): StmtNode {
    const caseTok = this.advance(); // CASE
    const discriminant = this.parseExpression();

    if (!this.match('OF')) {
      this.error(
        this.peek(),
        `第 ${caseTok.line} 行: CASE 表达式后缺少关键字 'OF'`,
        '正确语法：CASE #step OF 0: ... END_CASE;'
      );
    }

    const branches: CaseBranch[] = [];

    while (!this.check('EOF') && !this.check('ELSE') && !this.check('END_CASE') && !this.check('END_REGION')) {
      if (this.match('SEMI')) continue;

      if (!this.isCaseLabelStart()) {
        const bad = this.peek();
        this.error(
          bad,
          `第 ${bad.line} 行: CASE 块中期望分支常量标签（如 0: 或 10..20:），实际遇到 '${bad.value || bad.type}'`,
          '每个 CASE 分支须以整数常量及英文冒号结尾，例如 10: 或 10, 20: 或 30..40:'
        );
        this.synchronize();
        if (!this.isCaseLabelStart() && !this.check('ELSE') && !this.check('END_CASE')) {
          this.advance();
        }
        continue;
      }

      const labelStart = this.peek();
      const matchers: CaseMatcher[] = [];

      do {
        const low = this.parseCaseInt();
        if (this.match('RANGE')) {
          const high = this.parseCaseInt();
          matchers.push({ low, high });
        } else {
          matchers.push({ low });
        }
      } while (this.match('COMMA'));

      if (!this.match('COLON')) {
        const cur = this.peek();
        this.error(
          cur,
          `第 ${labelStart.line} 行: CASE 分支标签后缺少冒号 ':'`,
          '正确语法：10: 或 30..40:'
        );
      }

      const body = this.parseStatementList(
        () =>
          this.isCaseLabelStart() ||
          this.check('ELSE') ||
          this.check('END_CASE') ||
          this.check('END_REGION')
      );

      branches.push({
        matchers,
        body,
        line: labelStart.line,
        col: labelStart.col,
      });
    }

    let elseBody: StmtNode[] = [];
    let elseLine: number | undefined;
    if (this.check('ELSE')) {
      const elseTok = this.advance();
      elseLine = elseTok.line;
      this.match('COLON'); // Tolerate optional `ELSE:`
      elseBody = this.parseStatementList(() => this.check('END_CASE') || this.check('END_REGION'));
    }

    if (!this.match('END_CASE')) {
      this.error(
        caseTok,
        `第 ${caseTok.line} 行: CASE 语句未闭合，缺少 'END_CASE;'`,
        '请在 CASE 末尾添加 END_CASE;'
      );
    } else {
      this.match('SEMI');
    }

    return {
      kind: 'Case',
      discriminant,
      branches,
      elseBody,
      elseLine,
      line: caseTok.line,
      col: caseTok.col,
    };
  }

  private parseFor(): StmtNode {
    const forTok = this.advance(); // FOR
    const iterTok = this.peek();

    let iterator: VarRefExpr;
    if (
      iterTok.type === 'LOCAL_VAR' ||
      iterTok.type === 'IDENT' ||
      iterTok.type === 'QUOTED_TAG' ||
      iterTok.type === 'DIRECT_ADDR'
    ) {
      iterator = this.makeVarRef(this.advance());
    } else {
      this.error(
        iterTok,
        `第 ${forTok.line} 行: FOR 后缺少循环控制变量`,
        '正确语法：FOR #i := 1 TO 10 BY 1 DO ... END_FOR;'
      );
      iterator = { kind: 'VarRef', raw: '#i', name: '#i', style: 'local', line: forTok.line, col: forTok.col };
    }

    if (!this.match('ASSIGN')) {
      const eqTok = this.peek();
      if (eqTok.type === 'EQ' || eqTok.type === 'DOUBLE_EQ') {
        this.error(
          eqTok,
          `第 ${eqTok.line} 行: SCL 赋值必须写 ':='（单等号 '=' 仅用于比较相等）`,
          `请将 FOR 循环初始值赋值改为 ${iterator.raw} := ...`
        );
        this.advance();
      } else {
        this.error(
          eqTok,
          `第 ${forTok.line} 行: FOR 循环变量后缺少 ':='`,
          '正确语法：FOR #i := 0 TO 10 DO ... END_FOR;'
        );
      }
    }

    const from = this.parseExpression();

    if (!this.match('TO')) {
      this.error(
        this.peek(),
        `第 ${forTok.line} 行: FOR 循环缺少关键字 'TO'`,
        '正确语法：FOR #i := 0 TO 10 DO ... END_FOR;'
      );
    }

    const to = this.parseExpression();

    let by: ExprNode | undefined;
    if (this.match('BY')) {
      by = this.parseExpression();
    }

    if (!this.match('DO')) {
      this.error(
        this.peek(),
        `第 ${forTok.line} 行: FOR 循环缺少关键字 'DO'`,
        '正确语法：FOR #i := 0 TO 10 DO ... END_FOR;'
      );
    }

    const body = this.parseStatementList(() => this.check('END_FOR') || this.check('END_REGION'));

    if (!this.match('END_FOR')) {
      this.error(
        forTok,
        `第 ${forTok.line} 行: FOR 循环未闭合，缺少 'END_FOR;'`,
        '请在循环末尾添加 END_FOR;'
      );
    } else {
      this.match('SEMI');
    }

    return {
      kind: 'For',
      iterator,
      from,
      to,
      by,
      body,
      line: forTok.line,
      col: forTok.col,
    };
  }

  private parseWhile(): StmtNode {
    const whileTok = this.advance();
    const condition = this.parseExpression();

    if (!this.match('DO')) {
      this.error(
        this.peek(),
        `第 ${whileTok.line} 行: WHILE 条件后缺少关键字 'DO'`,
        '正确语法：WHILE 条件 DO ... END_WHILE;'
      );
    }

    const body = this.parseStatementList(() => this.check('END_WHILE') || this.check('END_REGION'));

    if (!this.match('END_WHILE')) {
      this.error(
        whileTok,
        `第 ${whileTok.line} 行: WHILE 循环未闭合，缺少 'END_WHILE;'`,
        '请在循环末尾添加 END_WHILE;'
      );
    } else {
      this.match('SEMI');
    }

    return {
      kind: 'While',
      condition,
      body,
      line: whileTok.line,
      col: whileTok.col,
    };
  }

  private parseRepeat(): StmtNode {
    const repTok = this.advance();
    const body = this.parseStatementList(() => this.check('UNTIL') || this.check('END_REPEAT') || this.check('END_REGION'));

    if (!this.match('UNTIL')) {
      this.error(
        this.peek(),
        `第 ${repTok.line} 行: REPEAT 循环缺少关键字 'UNTIL'`,
        '正确语法：REPEAT ... UNTIL 条件 END_REPEAT;'
      );
    }

    const until = this.parseExpression();

    if (!this.match('END_REPEAT')) {
      this.error(
        repTok,
        `第 ${repTok.line} 行: REPEAT 循环未闭合，缺少 'END_REPEAT;'`,
        '请在循环末尾添加 END_REPEAT;'
      );
    } else {
      this.match('SEMI');
    }

    return {
      kind: 'Repeat',
      body,
      until,
      line: repTok.line,
      col: repTok.col,
    };
  }

  private makeVarRef(tok: Token): VarRefExpr {
    switch (tok.type) {
      case 'QUOTED_TAG':
        return {
          kind: 'VarRef',
          raw: `"${tok.value}"`,
          name: tok.value,
          style: 'quoted',
          line: tok.line,
          col: tok.col,
        };
      case 'LOCAL_VAR':
        return {
          kind: 'VarRef',
          raw: tok.value,
          name: tok.value,
          style: 'local',
          line: tok.line,
          col: tok.col,
        };
      case 'DIRECT_ADDR':
        return {
          kind: 'VarRef',
          raw: tok.value,
          name: tok.value,
          style: 'direct',
          line: tok.line,
          col: tok.col,
        };
      default:
        return {
          kind: 'VarRef',
          raw: tok.value,
          name: tok.value,
          style: 'plain',
          line: tok.line,
          col: tok.col,
        };
    }
  }

  private parseTargetChain(): AssignTarget {
    let target: AssignTarget = this.makeVarRef(this.advance());
    while (this.match('DOT')) {
      const propTok = this.peek();
      if (propTok.type === 'IDENT' || propTok.type === 'QUOTED_TAG' || propTok.type === 'NUMBER') {
        this.advance();
        target = {
          kind: 'Member',
          object: target,
          property: propTok.value,
          line: target.line,
          col: target.col,
        } as MemberExpr;
      } else {
        this.error(
          propTok,
          `第 ${propTok.line} 行: '.' 后缺少成员属性名`,
          '示例：#ton1.Q、#ton1.ET、#ctu1.CV'
        );
        break;
      }
    }
    return target;
  }

  private parseAssignOrCall(): StmtNode | null {
    const startTok = this.peek();
    const target = this.parseTargetChain();

    // 1. FB / Function call statement: `#ton1(IN := ..., PT := T#3s, Q => ...);`
    if (this.check('LPAREN')) {
      const args = this.parseCallArgs();
      const endLine = this.peek().line;
      this.expectSemi(startTok.line === endLine ? startTok.line : startTok.line);
      return {
        kind: 'CallStmt',
        target,
        args,
        line: startTok.line,
        col: startTok.col,
      };
    }

    // 2. Normal assignment: `Target := Expr;`
    if (this.match('ASSIGN')) {
      const value = this.parseExpression();
      this.expectSemi(startTok.line);
      return {
        kind: 'Assign',
        target,
        value,
        line: startTok.line,
        col: startTok.col,
      };
    }

    // 3. Beginner mistake: `Target = Expr;` or `Target == Expr;`
    if (this.check('EQ') || this.check('DOUBLE_EQ')) {
      const eqTok = this.advance();
      this.error(
        eqTok,
        `第 ${eqTok.line} 行: SCL 赋值必须写 ':='（单等号 '=' 仅用于比较相等）`,
        `请将 '${eqTok.value}' 修改为 ':='，例如 ${formatTargetDisplay(target)} := ...;`
      );
      // Parse RHS to avoid cascading syntax errors on the same line
      const value = this.parseExpression();
      this.match('SEMI');
      return {
        kind: 'Assign',
        target,
        value,
        line: startTok.line,
        col: startTok.col,
      };
    }

    // 4. Unexpected token after target
    const cur = this.peek();
    this.error(
      cur,
      `第 ${startTok.line} 行: '${formatTargetDisplay(target)}' 后期望 ':=' 赋值符号或 '(...)' 功能块调用`,
      `赋值写法：${formatTargetDisplay(target)} := TRUE;  功能块调用：#ton1(IN := ..., PT := T#3s);`
    );
    this.synchronize();
    return null;
  }

  private parseCallArgs(): CallArg[] {
    const openTok = this.advance(); // '('
    const args: CallArg[] = [];

    if (this.match('RPAREN')) {
      return args;
    }

    while (!this.check('EOF') && !this.check('RPAREN')) {
      const argStart = this.peek();

      // Check named argument: `PARAM := expr` or `PARAM => target` or beginner mistake `PARAM = expr`
      if (argStart.type === 'IDENT' && (this.peek(1).type === 'ASSIGN' || this.peek(1).type === 'OUT_ARROW' || this.peek(1).type === 'EQ')) {
        const paramName = this.advance().value;
        const opTok = this.advance();

        if (opTok.type === 'EQ') {
          this.error(
            opTok,
            `第 ${opTok.line} 行: SCL 参数赋值必须写 ':='（单等号 '=' 仅用于比较相等）`,
            `请将 ${paramName} = ... 修改为 ${paramName} := ...`
          );
        }

        const direction: 'in' | 'out' = opTok.type === 'OUT_ARROW' ? 'out' : 'in';
        const expr = this.parseExpression();

        if (direction === 'out' && expr.kind !== 'VarRef' && expr.kind !== 'Member') {
          this.error(
            argStart,
            `第 ${argStart.line} 行: 输出参数 '${paramName} =>' 右侧必须是可写变量`,
            '示例：Q => "KM1_Motor" 或 ET => #elapsedTime'
          );
        }

        args.push({
          name: paramName.toUpperCase(),
          direction,
          expr,
          line: argStart.line,
          col: argStart.col,
        });
      } else {
        // Positional argument
        const expr = this.parseExpression();
        args.push({
          direction: 'in',
          expr,
          line: argStart.line,
          col: argStart.col,
        });
      }

      if (!this.match('COMMA')) {
        break;
      }
    }

    if (!this.match('RPAREN')) {
      this.error(
        openTok,
        `第 ${openTok.line} 行: 调用参数列表缺少右括号 ')'`,
        "请在参数列表末尾补全 ')'"
      );
    }

    return args;
  }

  // ─── Recursive Descent Expression Grammar ──────────────────────────────────
  // Precedence (low -> high):
  //   OR  <  XOR  <  AND (&)  <  Comparison (=, <>, <, <=, >, >=)
  //       <  Additive (+, -)  <  Multiplicative (*, /, MOD)  <  Unary (NOT, -, +)  <  Primary

  private parseExpression(): ExprNode {
    return this.parseOr();
  }

  private parseOr(): ExprNode {
    let left = this.parseXor();
    while (this.check('OR')) {
      const opTok = this.advance();
      const right = this.parseXor();
      left = { kind: 'Binary', op: 'OR', left, right, line: opTok.line, col: opTok.col };
    }
    return left;
  }

  private parseXor(): ExprNode {
    let left = this.parseAnd();
    while (this.check('XOR')) {
      const opTok = this.advance();
      const right = this.parseAnd();
      left = { kind: 'Binary', op: 'XOR', left, right, line: opTok.line, col: opTok.col };
    }
    return left;
  }

  private parseAnd(): ExprNode {
    let left = this.parseComparison();
    while (this.check('AND')) {
      const opTok = this.advance();
      const right = this.parseComparison();
      left = { kind: 'Binary', op: 'AND', left, right, line: opTok.line, col: opTok.col };
    }
    return left;
  }

  private parseComparison(): ExprNode {
    let left = this.parseAdditive();
    while (true) {
      const cur = this.peek();
      let op: BinaryOp | null = null;
      if (cur.type === 'EQ') op = '=';
      else if (cur.type === 'NEQ') op = '<>';
      else if (cur.type === 'LT') op = '<';
      else if (cur.type === 'LTE') op = '<=';
      else if (cur.type === 'GT') op = '>';
      else if (cur.type === 'GTE') op = '>=';
      else if (cur.type === 'DOUBLE_EQ') {
        this.error(
          cur,
          `第 ${cur.line} 行: SCL 判断相等请使用单等号 '='（不要写 '=='）`,
          '示例：IF #step = 10 THEN ...'
        );
        op = '=';
      } else if (cur.type === 'BANG_EQ') {
        this.error(
          cur,
          `第 ${cur.line} 行: SCL 判断不等于请使用 '<>'（不要写 '!='）`,
          '示例：IF #step <> 0 THEN ...'
        );
        op = '<>';
      }

      if (!op) break;
      const opTok = this.advance();
      const right = this.parseAdditive();
      left = { kind: 'Binary', op, left, right, line: opTok.line, col: opTok.col };
    }
    return left;
  }

  private parseAdditive(): ExprNode {
    let left = this.parseMultiplicative();
    while (this.check('PLUS') || this.check('MINUS')) {
      const opTok = this.advance();
      const op: BinaryOp = opTok.type === 'PLUS' ? '+' : '-';
      const right = this.parseMultiplicative();
      left = { kind: 'Binary', op, left, right, line: opTok.line, col: opTok.col };
    }
    return left;
  }

  private parseMultiplicative(): ExprNode {
    let left = this.parseUnary();
    while (this.check('STAR') || this.check('SLASH') || this.check('MOD')) {
      const opTok = this.advance();
      const op: BinaryOp =
        opTok.type === 'STAR' ? '*' : opTok.type === 'SLASH' ? '/' : 'MOD';
      const right = this.parseUnary();
      left = { kind: 'Binary', op, left, right, line: opTok.line, col: opTok.col };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    const cur = this.peek();
    if (cur.type === 'NOT') {
      this.advance();
      return { kind: 'Unary', op: 'NOT', operand: this.parseUnary(), line: cur.line, col: cur.col };
    }
    if (cur.type === 'MINUS') {
      this.advance();
      return { kind: 'Unary', op: '-', operand: this.parseUnary(), line: cur.line, col: cur.col };
    }
    if (cur.type === 'PLUS') {
      this.advance();
      return { kind: 'Unary', op: '+', operand: this.parseUnary(), line: cur.line, col: cur.col };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprNode {
    const tok = this.peek();

    if (tok.type === 'NUMBER') {
      this.advance();
      return {
        kind: 'Literal',
        value: tok.numValue ?? 0,
        isTime: false,
        raw: tok.value,
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === 'TIME') {
      this.advance();
      return {
        kind: 'Literal',
        value: tok.numValue ?? 0,
        isTime: true,
        raw: tok.value,
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === 'BOOL') {
      this.advance();
      return {
        kind: 'Literal',
        value: tok.boolValue ?? false,
        raw: tok.value,
        line: tok.line,
        col: tok.col,
      };
    }

    if (tok.type === 'LPAREN') {
      const openTok = this.advance();
      const inner = this.parseExpression();
      if (!this.match('RPAREN')) {
        this.error(
          openTok,
          `第 ${openTok.line} 行: 括号 '(' 未闭合，缺少 ')'`,
          "请检查表达式中的括号是否成对匹配"
        );
      }
      return inner;
    }

    if (
      tok.type === 'QUOTED_TAG' ||
      tok.type === 'LOCAL_VAR' ||
      tok.type === 'DIRECT_ADDR' ||
      tok.type === 'IDENT'
    ) {
      const target = this.parseTargetChain();

      // Function call inside an expression: NORM_X(...), SCALE_X(...), LIMIT(...), ABS(...)
      if (this.check('LPAREN')) {
        const args = this.parseCallArgs();
        const callee =
          target.kind === 'VarRef' ? target.name : target.property;
        return {
          kind: 'Call',
          callee: callee.toUpperCase(),
          target,
          args,
          line: tok.line,
          col: tok.col,
        };
      }

      return target;
    }

    this.error(
      tok,
      `第 ${tok.line} 行: 表达式中出现意外符号 '${tok.value || tok.type}'`,
      '请检查运算符两侧是否缺少变量或常量'
    );
    // Advance only if not at a statement terminator or block boundary
    if (!BLOCK_END_TOKENS.has(tok.type) && tok.type !== 'SEMI' && tok.type !== 'THEN' && tok.type !== 'DO' && tok.type !== 'OF' && tok.type !== 'RPAREN') {
      this.advance();
    }
    return { kind: 'Literal', value: 0, raw: '0', line: tok.line, col: tok.col };
  }
}

/**
 * Parse and semantically check an SCL program against the current PLC tag table.
 */
export function parseAndCheckScl(source: string, tagDefs: TagDef[]): CompiledSclProgram {
  const { tokens, diagnostics: lexDiagnostics } = lexScl(source);
  const parser = new SclParser(tokens, lexDiagnostics);
  const statements = parser.parseProgram();
  const diagnostics = parser.diagnostics;

  // Build tag table lookups
  const exactTagMap = new Map<string, TagDef>();
  const lowerTagMap = new Map<string, TagDef>();
  const addrToTagMap = new Map<string, TagDef>();

  for (const def of tagDefs) {
    exactTagMap.set(def.name, def);
    lowerTagMap.set(def.name.toLowerCase(), def);
    if (def.address) {
      addrToTagMap.set(normalizeDirectAddress(def.address), def);
    }
  }

  const referencedSet = new Set<string>();
  const executableLineSet = new Set<number>();
  const warnedUnregistered = new Set<string>();

  const recordRef = (node: VarRefExpr) => {
    if (node.style === 'quoted') {
      const def = exactTagMap.get(node.name) ?? lowerTagMap.get(node.name.toLowerCase());
      if (def) {
        referencedSet.add(def.name);
      } else {
        referencedSet.add(node.name);
        if (tagDefs.length > 0 && !warnedUnregistered.has(node.name)) {
          warnedUnregistered.add(node.name);
          diagnostics.push({
            line: node.line,
            col: node.col,
            severity: 'warning',
            message: `第 ${node.line} 行: 全局变量 "${node.name}" 尚未在 PLC 变量表中定义`,
            hint: '运行时将自动为其分配临时内存；若需联调设备或强制，请在左侧「PLC 变量表」中添加该符号',
          });
        }
      }
    } else if (node.style === 'direct') {
      const norm = normalizeDirectAddress(node.name);
      const mapped = addrToTagMap.get(norm);
      referencedSet.add(mapped ? mapped.name : norm);
    } else if (node.style === 'plain') {
      const def = exactTagMap.get(node.name) ?? lowerTagMap.get(node.name.toLowerCase());
      if (def) {
        referencedSet.add(def.name);
      }
    }
  };

  const inspectExpr = (expr: ExprNode) => {
    switch (expr.kind) {
      case 'Literal':
        return;
      case 'VarRef':
        recordRef(expr);
        return;
      case 'Member':
        inspectExpr(expr.object);
        return;
      case 'Unary':
        inspectExpr(expr.operand);
        return;
      case 'Binary':
        inspectExpr(expr.left);
        inspectExpr(expr.right);
        return;
      case 'Call':
        if (!BUILTIN_FC_NAMES.has(expr.callee)) {
          diagnostics.push({
            line: expr.line,
            col: expr.col,
            severity: 'error',
            message: `第 ${expr.line} 行: 未知的标准函数 '${expr.callee}'`,
            hint: '支持函数：NORM_X、SCALE_X、LIMIT、MIN、MAX、ABS、SQRT、INT_TO_REAL、REAL_TO_INT、DINT_TO_REAL、TRUNC、ROUND、SEL',
          });
        }
        for (const arg of expr.args) {
          inspectExpr(arg.expr);
        }
        return;
    }
  };

  const inspectStmts = (list: StmtNode[]) => {
    for (const stmt of list) {
      executableLineSet.add(stmt.line);
      switch (stmt.kind) {
        case 'Assign':
          inspectExpr(stmt.target);
          inspectExpr(stmt.value);
          break;
        case 'CallStmt':
          // Do not warn if an FB instance DB name (e.g. "IEC_Timer_0_DB".TON) isn't in PLC I/O tags
          for (const arg of stmt.args) {
            inspectExpr(arg.expr);
          }
          break;
        case 'If':
          for (const br of stmt.branches) {
            executableLineSet.add(br.line);
            inspectExpr(br.condition);
            inspectStmts(br.body);
          }
          if (stmt.elseLine !== undefined) {
            executableLineSet.add(stmt.elseLine);
          }
          inspectStmts(stmt.elseBody);
          break;
        case 'Case':
          inspectExpr(stmt.discriminant);
          for (const br of stmt.branches) {
            executableLineSet.add(br.line);
            inspectStmts(br.body);
          }
          if (stmt.elseLine !== undefined) {
            executableLineSet.add(stmt.elseLine);
          }
          inspectStmts(stmt.elseBody);
          break;
        case 'For':
          inspectExpr(stmt.iterator);
          inspectExpr(stmt.from);
          inspectExpr(stmt.to);
          if (stmt.by) inspectExpr(stmt.by);
          inspectStmts(stmt.body);
          break;
        case 'While':
          inspectExpr(stmt.condition);
          inspectStmts(stmt.body);
          break;
        case 'Repeat':
          inspectStmts(stmt.body);
          inspectExpr(stmt.until);
          break;
        case 'Region':
          inspectStmts(stmt.body);
          break;
        case 'Exit':
        case 'Return':
        case 'Continue':
          break;
      }
    }
  };

  inspectStmts(statements);

  // Sort diagnostics by line then col
  diagnostics.sort((a, b) => (a.line !== b.line ? a.line - b.line : a.col - b.col));

  return {
    statements,
    declarations: parser.declarations,
    diagnostics,
    referencedTags: Array.from(referencedSet),
    executableLines: Array.from(executableLineSet).sort((a, b) => a - b),
  };
}
