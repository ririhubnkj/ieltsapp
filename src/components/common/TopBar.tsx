import type { ReactNode } from 'react';

interface TopBarProps {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}

export function TopBar({ title, left, right }: TopBarProps) {
  return (
    <div className="topbar">
      {left}
      <div className="topbar-title">{title}</div>
      {right}
    </div>
  );
}
