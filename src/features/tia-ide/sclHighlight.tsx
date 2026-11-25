import React from 'react';

export type SclTokenKind =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'builtin'
  | 'symbol'
  | 'local'
  | 'address'
  | 'time'
  | 'number'
  | 'operator'
  | 'string';

export interface SclToken {
  kind: SclTokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'IF',
  'THEN',
  'ELSIF',
  'ELSE',
  'END_IF',
  'CASE',
  'OF',
  'END_CASE',
  'FOR',
  'TO',
  'BY',
  'DO',
  'END_FOR',
  'WHILE',
  'END_WHILE',
  'REPEAT',
  'UNTIL',
  'END_REPEAT',
  'EXIT',
  'RETURN',
  'AND',
  'OR',
  'XOR',
  'NOT',
  'MOD',
  'TRUE',
  'FALSE',
  'REGION',
  'END_REGION',
  'VAR',
  'VAR_INPUT',
  'VAR_OUTPUT',
  'VAR_IN_OUT',
  'VAR_TEMP',
  'VAR_STATIC',
  'END_VAR',
  'BEGIN',
  'FUNCTION_BLOCK',
  'END_FUNCTION_BLOCK',
  'ORGANIZATION_BLOCK',
  'END_ORGANIZATION_BLOCK',
  'FUNCTION',
  'END_FUNCTION',
  'DATA_BLOCK',
  'END_DATA_BLOCK',
  'TYPE',
  'END_TYPE',
  'STRUCT',
  'END_STRUCT',
  'BOOL',
  'INT',
  'DINT',
  'REAL',
  'LREAL',
  'WORD',
  'DWORD',
  'TIME',
  'STRING',
]);

const BUILTINS = new Set([
  'TON',
  'TOF',
  'TP',
  'CTU',
  'CTD',
  'R_TRIG',
  'F_TRIG',
  'P_TRIG',
  'N_TRIG',
  'NORM_X',
  'SCALE_X',
  'LIMIT',
  'MIN',
  'MAX',
  'ABS',
  'SQRT',
  'INT_TO_REAL',
  'REAL_TO_INT',
  'DINT_TO_REAL',
  'TRUNC',
  'ROUND',
]);

/**
 * 轻量高性能西门子 SCL 词法高亮分词器（支持跨行 (* ... *) 块注释追踪）
 */
export function tokenizeSclDocument(code: string): SclToken[][] {
  const lines = code.split('\n');
  const result: SclToken[][] = [];
  let inBlockComment = false;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const tokens: SclToken[] = [];
    let i = 0;
    const len = line.length;

    while (i < len) {
      if (inBlockComment) {
        const endIdx = line.indexOf('*)', i);
        if (endIdx === -1) {
          tokens.push({ kind: 'comment', text: line.slice(i) });
          i = len;
        } else {
          tokens.push({ kind: 'comment', text: line.slice(i, endIdx + 2) });
          i = endIdx + 2;
          inBlockComment = false;
        }
        continue;
      }

      // Single-line comment //
      if (line[i] === '/' && line[i + 1] === '/') {
        tokens.push({ kind: 'comment', text: line.slice(i) });
        break;
      }

      // Block comment (* ... *)
      if (line[i] === '(' && line[i + 1] === '*') {
        const endIdx = line.indexOf('*)', i + 2);
        if (endIdx === -1) {
          tokens.push({ kind: 'comment', text: line.slice(i) });
          inBlockComment = true;
          break;
        } else {
          tokens.push({ kind: 'comment', text: line.slice(i, endIdx + 2) });
          i = endIdx + 2;
          continue;
        }
      }

      // Double-quoted PLC global symbol "Start_PB"
      if (line[i] === '"') {
        let j = i + 1;
        while (j < len && line[j] !== '"') j++;
        if (j < len) j++;
        tokens.push({ kind: 'symbol', text: line.slice(i, j) });
        i = j;
        continue;
      }

      // Single-quoted string literal 'LFP-100Ah'
      if (line[i] === "'") {
        let j = i + 1;
        while (j < len && line[j] !== "'") j++;
        if (j < len) j++;
        tokens.push({ kind: 'string', text: line.slice(i, j) });
        i = j;
        continue;
      }

      // Direct PLC address: %I0.0, %Q0.1, %M0.0, %IW64, %QW80, %MW20, %MD10
      if (line[i] === '%') {
        const match = line.slice(i).match(/^%[IQM][BWDX]?\d+(?:\.\d+)?/i);
        if (match) {
          tokens.push({ kind: 'address', text: match[0] });
          i += match[0].length;
          continue;
        }
      }

      // Local variable / instance: #ton1, #statStep, #ton1.ET
      if (line[i] === '#') {
        const match = line.slice(i).match(/^#[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/);
        if (match) {
          tokens.push({ kind: 'local', text: match[0] });
          i += match[0].length;
          continue;
        }
      }

      // IEC Time literal: T#500ms, T#3s, T#1m2s500ms, TIME#2s
      if (
        (line[i] === 'T' || line[i] === 't') &&
        (line[i + 1] === '#' || line.slice(i, i + 5).toUpperCase() === 'TIME#')
      ) {
        const match = line.slice(i).match(/^(?:TIME|T)#[0-9A-Za-z_.]+/i);
        if (match) {
          tokens.push({ kind: 'time', text: match[0] });
          i += match[0].length;
          continue;
        }
      }

      // Radix / numeric literal: 16#047F, 2#1010, 3.14, 27648
      if (/[0-9]/.test(line[i])) {
        const match = line
          .slice(i)
          .match(/^(?:(?:16|8|2)#[0-9A-Fa-f_]+|\d+(?:\.\d+)?)/);
        if (match) {
          tokens.push({ kind: 'number', text: match[0] });
          i += match[0].length;
          continue;
        }
      }

      // Identifier / Keyword / Builtin
      if (/[A-Za-z_]/.test(line[i])) {
        const match = line.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (match) {
          const word = match[0];
          const upper = word.toUpperCase();
          if (KEYWORDS.has(upper)) {
            tokens.push({ kind: 'keyword', text: word });
          } else if (BUILTINS.has(upper)) {
            tokens.push({ kind: 'builtin', text: word });
          } else {
            tokens.push({ kind: 'plain', text: word });
          }
          i += word.length;
          continue;
        }
      }

      // Multi-char operators
      const two = line.slice(i, i + 2);
      if (two === ':=' || two === '=>' || two === '<>' || two === '<=' || two === '>=' || two === '..') {
        tokens.push({ kind: 'operator', text: two });
        i += 2;
        continue;
      }

      // Single-char operators / punctuation
      if ('+-*/=<>:&();,:'.includes(line[i])) {
        tokens.push({ kind: 'operator', text: line[i] });
        i++;
        continue;
      }

      // Whitespace or other characters (batch contiguous plain chars)
      let j = i + 1;
      while (
        j < len &&
        !/[A-Za-z0-9_"'#%/:*()+\-=<>:&;,.]/.test(line[j])
      ) {
        j++;
      }
      tokens.push({ kind: 'plain', text: line.slice(i, j) });
      i = j;
    }

    result.push(tokens);
  }

  return result;
}

export const renderSclLineTokens = (tokens: SclToken[]): React.ReactNode => {
  if (tokens.length === 0) return '\u00A0';
  return tokens.map((tok, idx) =>
    tok.kind === 'plain' ? (
      <React.Fragment key={idx}>{tok.text}</React.Fragment>
    ) : (
      <span key={idx} className={`tia-tok-${tok.kind}`}>
        {tok.text}
      </span>
    )
  );
};
