import * as React from 'react';

import {classNames} from '@utils/utils';

interface Props {
  dataCellId: string;
  value: string;
  isHeader?: boolean;
  isDefaultValue?: boolean;
}

export function CellView({dataCellId, value, isHeader, isDefaultValue}: Props) {
  const className = classNames("cell-view", {
    header: !!isHeader,
    defaultValue: !!isDefaultValue,
  });
  return (
    <div className={className} data-cell-id={dataCellId}>
      <div className="value">
        {value}
      </div>
    </div>
  );
}
