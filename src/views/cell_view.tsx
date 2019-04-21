import * as React from 'react';
import {classNames} from 'src/utils/utils';

interface Props {
  dataCellId: string;
  value: string;
  isHeader?: boolean;
}

export function CellView({dataCellId, value, isHeader}: Props) {
  const className = classNames("cell-view", {header: !!isHeader});
  return (
    <div className={className} data-cell-id={dataCellId}>
      <div className="value">
        {value}
      </div>
    </div>
  );
}
