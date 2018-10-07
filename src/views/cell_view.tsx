import * as React from 'react';

interface Props {
  value: string;
}

export function CellView({value}: Props) {
  return (
    <div className="cell-view">
      <div className="value">
        {value}
      </div>
    </div>
  );
}
