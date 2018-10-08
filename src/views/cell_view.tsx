import * as React from 'react';

interface Props {
  value: string;
  isHeader?: boolean;
}

export function CellView({value, isHeader}: Props) {
  const className = "cell-view" + (isHeader ? " header" : "");
  return (
    <div className={className}>
      <div className="value">
        {value}
      </div>
    </div>
  );
}
