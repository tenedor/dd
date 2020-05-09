import * as React from 'react';

import {classNames} from '@utils/utils';

interface Props {
  dataCellId: string;
  value: string;
  isHeader?: boolean;
  isDefaultValue?: boolean;
  setWidth?: (delta: number) => void;
}

export function CellView({dataCellId, value, isHeader, isDefaultValue, setWidth}: Props) {
  const className = classNames("cell-view", {
    header: !!isHeader,
    defaultValue: !!isDefaultValue,
  });
  return (
    <div className={className} data-cell-id={dataCellId}>
      <div className="value">
        {value}
      </div>
      {!!setWidth ? <div className="resizer"/> : []}
    </div>
  );
}
