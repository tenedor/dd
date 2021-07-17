import * as _ from 'lodash';

import {CoordinateSystem} from '@core/geometry';
import {FormulaEnvironment} from '@language/formula_environment';
import {Namespace, NamespaceUtils} from '@language/reference/namespace';
import {Type, TypeUtils} from '@language/types';
import {NumberValue, RowValue, Value} from '@language/values';
import {ModelType} from '@models/core/model';
import {UpdateManager} from '@models/core/update_manager';
import {Column} from '@models/domain_specific/column';

export const coordinateSystemColumnName = "Transform";
export const COORDINATE_SYSTEM_GRID_NAME = 'Coordinate System';
// This id should match the UID pattern for columns
export const COORDINATE_SYSTEM_CENTER_COLUMN_ID = `${ModelType.COLUMN}-_COORDINATE_CENTER_`;
export const COORDINATE_SYSTEM_COLUMN_ID = `${ModelType.COLUMN}-_COORDINATE_SYSTEM_`;

let coordinateSystemColumn: Column | undefined;

export const getCoordinateSystemColumn = (
  updateManager: UpdateManager,
  namespace: Namespace,
): Column<Type>  => {
  if (!coordinateSystemColumn) {
    const coordinateSystemGridId = namespace.getGridIdByName(COORDINATE_SYSTEM_GRID_NAME);
    if (coordinateSystemGridId === undefined) {
      throw new Error("Coordinate system grid does not exist.");
    }
    coordinateSystemColumn = new Column(updateManager, {
      id: COORDINATE_SYSTEM_COLUMN_ID,
      name: coordinateSystemColumnName,
      type: TypeUtils.RowOf(coordinateSystemGridId),
    }, {});
  }
  return coordinateSystemColumn;
}

export const getCoordinateSystemFromValue = (csValue: RowValue, environment: FormulaEnvironment): CoordinateSystem => {
  const centerValue = project(csValue, 'Center', environment) as RowValue;
  const xValue = project(centerValue, 'X', environment) as NumberValue;
  const yValue = project(centerValue, 'Y', environment) as NumberValue;
  const scaleValue = project(csValue, 'Scale', environment) as NumberValue;
  const rotationValue = project(csValue, 'Rotation', environment) as RowValue;
  const ccwValue = project(rotationValue, 'Rotation CCW', environment) as NumberValue;
  const x = xValue.value;
  const y = yValue.value;
  const center = {x, y}
  const scale = scaleValue.value;
  const ccw = ccwValue.value;
  const rotation = {ccw};
  return {center, scale, rotation};
}

const project = (rowValue: RowValue, columnName: string, environment: FormulaEnvironment): Value => {
  const namespace = environment.getInstanceNamespace(rowValue.type);
  const columnRef = NamespaceUtils.getValueReferenceByNameOrThrow(columnName, namespace);
  return rowValue.dict[columnRef.id];
}