import type { Token, TokenType } from './ast';
import type { SclDiagnostic } from './types';

export interface LexResult {
  tokens: Token[];
  diagnostics: SclDiagnostic[];
}

const KEYWORDS: Record<string, TokenType> = {
  IF: 'IF',
  THEN: 'THEN',
  ELSIF: 'ELSIF',
  ELSE: 'ELSE',
  END_IF: 'END_IF',
  CASE: 'CASE',
  OF: 'OF',
  END_CASE: 'END_CASE',
  FOR: 'FOR',
  TO: 'TO',
  BY: 'BY',
  DO: 'DO',
  END_FOR: 'END_FOR',
  WHILE: 'WHILE',
  END_WHILE: 'END_WHILE',
  REPEAT: 'REPEAT',
  UNTIL: 'UNTIL',
  END_REPEAT: 'END_REPEAT',
  EXIT: 'EXIT',
  RETURN: 'RETURN',
  CONTINUE: 'CONTINUE',
  REGION: 'REGION',
  END_REGION: 'END_REGION',
  AND: 'AND',
  OR: 'OR',
  XOR: 'XOR',
  NOT: 'NOT',
  MOD: 'MOD',
  TRUE: 'BOOL',
  FALSE: 'BOOL',
  // Optional TIA Portal SCL block wrapper keywords
  VAR: 'VAR_SECTION',
  VAR_INPUT: 'VAR_SECTION',
  VAR_OUTPUT: 'VAR_SECTION',
  VAR_IN_OUT: 'VAR_SECTION',
  VAR_TEMP: 'VAR_SECTION',
  VAR_STAT: 'VAR_SECTION',
  VAR_CONSTANT: 'VAR_SECTION',
  END_VAR: 'END_VAR',
  BEGIN: 'BEGIN',
  ORGANIZATION_BLOCK: 'BLOCK_HEADER',
  FUNCTION_BLOCK: 'BLOCK_HEADER',
  FUNCTION: 'BLOCK_HEADER',
  DATA_BLOCK: 'BLOCK_HEADER',
  END_ORGANIZATION_BLOCK: 'END_BLOCK',
  END_FUNCTION_BLOCK: 'END_BLOCK',
  END_FUNCTION: 'END_BLOCK',
  END_DATA_BLOCK: 'END_BLOCK',
};

const TYPED_LITERAL_PREFIXES = new Set([
  'BOOL',
  'BYTE',
  'WORD',
  'DWORD',
  'LWORD',
  'SINT',
  'USINT',
  'INT',
  'UINT',
  'DINT',
  'UDINT',
  'LINT',
  'ULINT',
  'REAL',
  'LREAL',
]);

const TIME_PREFIXES = new Set(['T', 'TIME', 'LT', 'LTIME']);

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    ch === '_' ||
    code > 127 // Support Unicode / Chinese identifiers if typed
  );
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

function isHexDigit(ch: string): boolean {
  return (
    isDigit(ch) ||
    (ch >= 'a' && ch <= 'f') ||
    (ch >= 'A' && ch <= 'F')
  );
}

/**
 * Parse an IEC 61131-3 duration body after `T#` / `TIME#`, e.g. `500ms`, `3s`, `1m2s500ms`, `1.5s`.
 * Returns milliseconds, or null if malformed.
 */
export function parseIecTimeLiteral(body: string): number | null {
  const cleaned = body.replace(/_/g, '').trim();
  if (!cleaned) return null;

  let sign = 1;
  let rest = cleaned;
  if (rest.startsWith('-')) {
    sign = -1;
    rest = rest.slice(1);
  } else if (rest.startsWith('+')) {
    rest = rest.slice(1);
  }

  // Match units in descending specificity: ms, us, ns BEFORE m, s
  const partRegex = /(\d+(?:\.\d+)?)(ms|us|ns|d|h|m|s)/gi;
  let totalMs = 0;
  let consumedLen = 0;
  let match: RegExpExecArray | null;

  while ((match = partRegex.exec(rest)) !== null) {
    if (match.index !== consumedLen) {
      return null;
    }
    consumedLen += match[0].length;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return null;
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'd':
        totalMs += amount * 86_400_000;
        break;
      case 'h':
        totalMs += amount * 3_600_000;
        break;
      case 'm':
        totalMs += amount * 60_000;
        break;
      case 's':
        totalMs += amount * 1_000;
        break;
      case 'ms':
        totalMs += amount;
        break;
      case 'us':
        totalMs += amount * 0.001;
        break;
      case 'ns':
        totalMs += amount * 0.000001;
        break;
      default:
        return null;
    }
  }

  if (consumedLen === 0 || consumedLen !== rest.length) {
    return null;
  }

  return sign * totalMs;
}

/**
 * Normalize a Siemens direct address such as `%i0.0`, `%IX0.0`, `%mw10`, `%qw80`.
 */
export function normalizeDirectAddress(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const withPct = upper.startsWith('%') ? upper : `%${upper}`;
  // Normalize IEC bit prefixes %IX0.0 -> %I0.0, %QX0.0 -> %Q0.0, %MX0.0 -> %M0.0
  const bitMatch = /^%([IQM])X(\d+\.\d+)$/.exec(withPct);
  if (bitMatch) {
    return `%${bitMatch[1]}${bitMatch[2]}`;
  }
  return withPct;
}

/**
 * Pure frontend, zero-eval Siemens TIA Portal SCL (IEC 61131-3 ST) Lexer.
 */
export function lexScl(source: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: SclDiagnostic[] = [];

  const len = source.length;
  let i = 0;
  let line = 1;
  let col = 1;

  const peek = (offset = 0): string => (i + offset < len ? source[i + offset] : '');

  const advance = (): string => {
    const ch = source[i++];
    if (ch === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    return ch;
  };

  const pushError = (errLine: number, errCol: number, message: string, hint?: string) => {
    diagnostics.push({
      line: errLine,
      col: errCol,
      severity: 'error',
      message,
      hint,
    });
  };

  while (i < len) {
    const ch = peek();

    // 1. Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }

    // 2. Single-line comment: // ...
    if (ch === '/' && peek(1) === '/') {
      while (i < len && peek() !== '\n') {
        advance();
      }
      continue;
    }

    // 3. Block comment: (* ... *) (supports nesting)
    if (ch === '(' && peek(1) === '*') {
      const startLine = line;
      const startCol = col;
      advance();
      advance();
      let depth = 1;
      while (i < len && depth > 0) {
        if (peek() === '(' && peek(1) === '*') {
          depth += 1;
          advance();
          advance();
        } else if (peek() === '*' && peek(1) === ')') {
          depth -= 1;
          advance();
          advance();
        } else {
          advance();
        }
      }
      if (depth > 0) {
        pushError(
          startLine,
          startCol,
          `第 ${startLine} 行: 多行注释 '(*' 未闭合`,
          "请在注释末尾补上 '*)'"
        );
      }
      continue;
    }

    // 4. C-style block comment /* ... */ (graceful tolerance)
    if (ch === '/' && peek(1) === '*') {
      const startLine = line;
      const startCol = col;
      advance();
      advance();
      let closed = false;
      while (i < len) {
        if (peek() === '*' && peek(1) === '/') {
          advance();
          advance();
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) {
        pushError(startLine, startCol, `第 ${startLine} 行: 块注释 '/*' 未闭合`, "请补上 '*/'");
      }
      continue;
    }

    // 5. TIA Portal attribute pragma { S7_Optimized_Access := 'TRUE' }
    if (ch === '{') {
      const startLine = line;
      const startCol = col;
      advance();
      let depth = 1;
      while (i < len && depth > 0) {
        const c = advance();
        if (c === '{') depth += 1;
        else if (c === '}') depth -= 1;
      }
      if (depth > 0) {
        pushError(startLine, startCol, `第 ${startLine} 行: 属性块 '{' 未闭合`, "请补上 '}'");
      }
      continue;
    }

    const startLine = line;
    const startCol = col;

    // 6. Double-quoted Siemens global symbolic variable: "Start_PB"
    if (ch === '"') {
      advance(); // skip opening "
      let name = '';
      let closed = false;
      while (i < len && peek() !== '\n') {
        const c = advance();
        if (c === '"') {
          closed = true;
          break;
        }
        name += c;
      }
      if (!closed) {
        pushError(
          startLine,
          startCol,
          `第 ${startLine} 行: 双引号变量名未闭合`,
          '西门子全局符号变量需使用成对双引号包裹，例如 "Start_PB"'
        );
      } else if (name.trim().length === 0) {
        pushError(
          startLine,
          startCol,
          `第 ${startLine} 行: 双引号变量名不能为空`,
          '请在双引号内填写变量符号名，例如 "KM1_Motor"'
        );
      } else {
        tokens.push({
          type: 'QUOTED_TAG',
          value: name,
          line: startLine,
          col: startCol,
        });
      }
      continue;
    }

    // 7. Single-quoted string literal: 'text'
    if (ch === "'") {
      advance();
      let str = '';
      let closed = false;
      while (i < len && peek() !== '\n') {
        const c = advance();
        if (c === "'") {
          closed = true;
          break;
        }
        str += c;
      }
      if (!closed) {
        pushError(startLine, startCol, `第 ${startLine} 行: 字符串字面量单引号未闭合`, "请补上结尾单引号 '");
      } else {
        tokens.push({
          type: 'STRING',
          value: str,
          line: startLine,
          col: startCol,
        });
      }
      continue;
    }

    // 8. Local / static / instance variable: #statStep, #ton1
    if (ch === '#') {
      advance(); // consume '#'
      if (!isIdentStart(peek())) {
        pushError(
          startLine,
          startCol,
          `第 ${startLine} 行: '#' 后缺少局部变量名`,
          '局部变量/实例名应写成 #step、#ton1 等格式'
        );
        continue;
      }
      let ident = '';
      while (i < len && isIdentPart(peek())) {
        ident += advance();
      }
      tokens.push({
        type: 'LOCAL_VAR',
        value: `#${ident}`,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // 9. Direct PLC address: %I0.0, %Q0.0, %M0.0, %MW10, %IW64, %QW80, %DB1.DBD0
    if (ch === '%') {
      if (isIdentStart(peek(1))) {
        let raw = advance(); // '%'
        while (i < len) {
          const next = peek();
          if (isIdentPart(next)) {
            raw += advance();
          } else if (next === '.' && (isDigit(peek(1)) || isIdentStart(peek(1)))) {
            // Avoid consuming `..` range operator
            if (peek(1) === '.') break;
            raw += advance();
          } else {
            break;
          }
        }
        const normalized = normalizeDirectAddress(raw);
        tokens.push({
          type: 'DIRECT_ADDR',
          value: normalized,
          line: startLine,
          col: startCol,
        });
      } else {
        advance();
        pushError(
          startLine,
          startCol,
          `第 ${startLine} 行: 非法字符 '%'`,
          "SCL 求余请使用关键字 'MOD'；直接地址请写为 %I0.0、%Q0.0、%MW10、%IW64"
        );
      }
      continue;
    }

    // 10. Numbers & based integer literals: 16#047F, 2#1010, 8#77, 10#42, 27648, 3.14
    if (isDigit(ch)) {
      let raw = '';
      while (i < len && (isDigit(peek()) || peek() === '_')) {
        raw += advance();
      }

      // Check based integer literal: 16#..., 2#..., 8#..., 10#...
      if (peek() === '#') {
        const baseStr = raw.replace(/_/g, '');
        const base = Number(baseStr);
        advance(); // consume '#'
        let digits = '';
        while (i < len && (isHexDigit(peek()) || peek() === '_')) {
          digits += advance();
        }
        const cleanDigits = digits.replace(/_/g, '');
        if (![2, 8, 10, 16].includes(base)) {
          pushError(
            startLine,
            startCol,
            `第 ${startLine} 行: 不支持的进制前缀 '${baseStr}#'`,
            '西门子 SCL 仅支持 2#（二进制）、8#（八进制）、10#（十进制）和 16#（十六进制）'
          );
          continue;
        }
        if (!cleanDigits) {
          pushError(
            startLine,
            startCol,
            `第 ${startLine} 行: 进制字面量 '${baseStr}#' 后缺少数值`,
            '示例：16#047F 或 2#1010'
          );
          continue;
        }
        const validDigitPattern =
          base === 2 ? /^[01]+$/ : base === 8 ? /^[0-7]+$/ : base === 10 ? /^[0-9]+$/ : /^[0-9a-fA-F]+$/;
        if (!validDigitPattern.test(cleanDigits)) {
          pushError(
            startLine,
            startCol,
            `第 ${startLine} 行: '${baseStr}#${digits}' 包含超出 ${base} 进制范围的数字`,
            base === 2 ? '二进制仅允许 0 和 1' : `请检查 ${base} 进制字面量格式`
          );
          continue;
        }
        const parsed = parseInt(cleanDigits, base);
        tokens.push({
          type: 'NUMBER',
          value: `${baseStr}#${digits}`,
          numValue: parsed,
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Check decimal fraction (do NOT consume `..` range operator!)
      if (peek() === '.' && peek(1) !== '.' && isDigit(peek(1))) {
        raw += advance(); // '.'
        while (i < len && (isDigit(peek()) || peek() === '_')) {
          raw += advance();
        }
      }

      // Optional exponent: e.g. 1.5e-3
      if ((peek() === 'e' || peek() === 'E') && (isDigit(peek(1)) || ((peek(1) === '+' || peek(1) === '-') && isDigit(peek(2))))) {
        raw += advance();
        if (peek() === '+' || peek() === '-') {
          raw += advance();
        }
        while (i < len && isDigit(peek())) {
          raw += advance();
        }
      }

      const numVal = Number(raw.replace(/_/g, ''));
      tokens.push({
        type: 'NUMBER',
        value: raw,
        numValue: Number.isFinite(numVal) ? numVal : 0,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // 11. Identifiers, Keywords, IEC Time Literals (T#3s), Typed Literals (INT#10, WORD#16#047F)
    if (isIdentStart(ch)) {
      let ident = '';
      while (i < len && isIdentPart(peek())) {
        ident += advance();
      }
      const upper = ident.toUpperCase();

      // IEC Time literal: T#500ms, T#3s, T#1m2s500ms, TIME#1.5s
      if (TIME_PREFIXES.has(upper) && peek() === '#') {
        advance(); // consume '#'
        let body = '';
        if (peek() === '-' || peek() === '+') {
          body += advance();
        }
        while (i < len && (isIdentPart(peek()) || (peek() === '.' && peek(1) !== '.'))) {
          body += advance();
        }
        const ms = parseIecTimeLiteral(body);
        if (ms === null) {
          pushError(
            startLine,
            startCol,
            `第 ${startLine} 行: 无效的 IEC 时间字面量 '${ident}#${body}'`,
            '正确格式示例：T#500ms、T#3s、T#1m2s500ms、T#1.5s'
          );
          continue;
        }
        tokens.push({
          type: 'TIME',
          value: `${ident}#${body}`,
          numValue: ms,
          isTime: true,
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Typed literal: INT#100, REAL#3.14, WORD#16#047F, BOOL#1
      if (TYPED_LITERAL_PREFIXES.has(upper) && peek() === '#') {
        advance(); // consume '#'
        let body = '';
        if (peek() === '-' || peek() === '+') {
          body += advance();
        }
        while (i < len && (isIdentPart(peek()) || peek() === '#' || (peek() === '.' && peek(1) !== '.'))) {
          body += advance();
        }
        const cleanBody = body.replace(/_/g, '');
        if (upper === 'BOOL') {
          const b = cleanBody === '1' || cleanBody.toUpperCase() === 'TRUE';
          tokens.push({
            type: 'BOOL',
            value: `${ident}#${body}`,
            boolValue: b,
            line: startLine,
            col: startCol,
          });
          continue;
        }
        const baseMatch = /^(\d+)#([0-9a-fA-F]+)$/.exec(cleanBody);
        const parsed = baseMatch ? parseInt(baseMatch[2], Number(baseMatch[1])) : Number(cleanBody);
        if (!Number.isFinite(parsed)) {
          pushError(
            startLine,
            startCol,
            `第 ${startLine} 行: 无效的类型字面量 '${ident}#${body}'`,
            '示例：INT#100、REAL#3.14、WORD#16#047F'
          );
          continue;
        }
        tokens.push({
          type: 'NUMBER',
          value: `${ident}#${body}`,
          numValue: parsed,
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // REGION header: capture optional title text to end of line
      if (upper === 'REGION') {
        let titleText = '';
        while (i < len && peek() !== '\n' && peek() !== '\r') {
          titleText += advance();
        }
        tokens.push({
          type: 'REGION',
          value: 'REGION',
          regionTitle: titleText.trim(),
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Keywords
      const kwType = KEYWORDS[upper];
      if (kwType) {
        if (kwType === 'BOOL') {
          tokens.push({
            type: 'BOOL',
            value: upper,
            boolValue: upper === 'TRUE',
            line: startLine,
            col: startCol,
          });
        } else {
          tokens.push({
            type: kwType,
            value: upper,
            line: startLine,
            col: startCol,
          });
        }
        continue;
      }

      tokens.push({
        type: 'IDENT',
        value: ident,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // 12. Multi-character & single-character operators / punctuation
    const two = ch + peek(1);
    if (two === ':=') {
      advance();
      advance();
      tokens.push({ type: 'ASSIGN', value: ':=', line: startLine, col: startCol });
      continue;
    }
    if (two === '=>') {
      advance();
      advance();
      tokens.push({ type: 'OUT_ARROW', value: '=>', line: startLine, col: startCol });
      continue;
    }
    if (two === '..') {
      advance();
      advance();
      tokens.push({ type: 'RANGE', value: '..', line: startLine, col: startCol });
      continue;
    }
    if (two === '<>') {
      advance();
      advance();
      tokens.push({ type: 'NEQ', value: '<>', line: startLine, col: startCol });
      continue;
    }
    if (two === '<=') {
      advance();
      advance();
      tokens.push({ type: 'LTE', value: '<=', line: startLine, col: startCol });
      continue;
    }
    if (two === '>=') {
      advance();
      advance();
      tokens.push({ type: 'GTE', value: '>=', line: startLine, col: startCol });
      continue;
    }
    if (two === '==') {
      advance();
      advance();
      tokens.push({ type: 'DOUBLE_EQ', value: '==', line: startLine, col: startCol });
      continue;
    }
    if (two === '!=') {
      advance();
      advance();
      tokens.push({ type: 'BANG_EQ', value: '!=', line: startLine, col: startCol });
      continue;
    }
    if (two === '&&') {
      advance();
      advance();
      tokens.push({ type: 'AND', value: 'AND', line: startLine, col: startCol });
      continue;
    }

    switch (ch) {
      case '=':
        advance();
        tokens.push({ type: 'EQ', value: '=', line: startLine, col: startCol });
        break;
      case '<':
        advance();
        tokens.push({ type: 'LT', value: '<', line: startLine, col: startCol });
        break;
      case '>':
        advance();
        tokens.push({ type: 'GT', value: '>', line: startLine, col: startCol });
        break;
      case '+':
        advance();
        tokens.push({ type: 'PLUS', value: '+', line: startLine, col: startCol });
        break;
      case '-':
        advance();
        tokens.push({ type: 'MINUS', value: '-', line: startLine, col: startCol });
        break;
      case '*':
        advance();
        tokens.push({ type: 'STAR', value: '*', line: startLine, col: startCol });
        break;
      case '/':
        advance();
        tokens.push({ type: 'SLASH', value: '/', line: startLine, col: startCol });
        break;
      case '&':
        advance();
        tokens.push({ type: 'AND', value: '&', line: startLine, col: startCol });
        break;
      case '(':
        advance();
        tokens.push({ type: 'LPAREN', value: '(', line: startLine, col: startCol });
        break;
      case ')':
        advance();
        tokens.push({ type: 'RPAREN', value: ')', line: startLine, col: startCol });
        break;
      case '[':
        advance();
        tokens.push({ type: 'LBRACKET', value: '[', line: startLine, col: startCol });
        break;
      case ']':
        advance();
        tokens.push({ type: 'RBRACKET', value: ']', line: startLine, col: startCol });
        break;
      case ',':
        advance();
        tokens.push({ type: 'COMMA', value: ',', line: startLine, col: startCol });
        break;
      case ';':
        advance();
        tokens.push({ type: 'SEMI', value: ';', line: startLine, col: startCol });
        break;
      case ':':
        advance();
        tokens.push({ type: 'COLON', value: ':', line: startLine, col: startCol });
        break;
      case '.':
        advance();
        tokens.push({ type: 'DOT', value: '.', line: startLine, col: startCol });
        break;
      default:
        advance();
        pushError(
          startLine,
          startCol,
          `第 ${startLine} 行: 无法识别的符号 '${ch}'`,
          ch === '!'
            ? "SCL 逻辑取反请使用关键字 'NOT'，不等于请使用 '<>'"
            : ch === '；' || ch === '：' || ch === '“' || ch === '”'
              ? '检测到中文全角标点，请切换为英文半角标点（; : "）'
              : '请检查是否输入了非法的标点或字符'
        );
        break;
    }
  }

  tokens.push({ type: 'EOF', value: '', line, col });
  return { tokens, diagnostics };
}
