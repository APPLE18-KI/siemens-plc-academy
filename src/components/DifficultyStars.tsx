import React from 'react';

/** 难度星级（1~4 颗），附带读屏文字 */
export const DifficultyStars: React.FC<{ level: number; max?: number }> = ({ level, max = 4 }) => (
  <span className="difficulty-stars" aria-label={`难度 ${level}/${max}`} role="img">
    {Array.from({ length: max }, (_, i) => (
      <span key={i} className={i < level ? 'on' : ''} aria-hidden="true">
        ★
      </span>
    ))}
  </span>
);
