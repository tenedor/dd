import * as _ from 'lodash';

import {Vector} from '@core/geometry';
import {Drawing, DrawingUtils} from '@drawing/drawing';
import {FormulaEnvironment, MutableFormulaEnvironment} from '@language/formula_environment';
import {DictNamespace} from '@language/reference/dict_namespace';
import {Namespace, ValueNamespace} from '@language/reference/namespace';
import {ValueReference} from '@language/reference/reference';
import {Identifier, Type, TypeUtils} from '@language/types';
import {GridValue, Value} from '@language/values';
import {Address, AddressUtils} from '@paths/address';
import {getCoordinateSystemColumn} from '@standard_library/geometry_utils';
import {RODictionary} from '@utils/types';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM}
        from '../collections/functional_array';
import {FunctionalKeyedArray} from '../collections/functional_keyed_array';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {GridUpdateType} from '../core/update_types';
import {Column} from './column';
import {DEFAULT_COLUMN_WIDTH, GridColumn, GridColumnUpdateDescriptor}
        from './grid_column';
import {Constructor, ConstructorUpdateDescriptor, GridConstructor} from './procedure';
import {Row, RowUpdateDescriptor} from './row';

export type GridColumns = FunctionalKeyedArray<GridColumn, GridColumnUpdateDescriptor, 'columnId'>;
export type Rows = FunctionalArrayM<Row, RowUpdateDescriptor>;

export interface CellIndex {
  columnId: string,
  rowIndex: number,
}

export interface GridData {
  environment: MutableFormulaEnvironment;
  name: string,
  parentGrid?: Grid,
  newColumns?: Column[],
  getPrimitiveDrawing?: (cells: RODictionary<Value>) => Drawing,
  disableCoordinateSystemColumn?: boolean;
}

export interface GridUpdateDescriptor extends UpdateDescriptor<GridUpdateType> {}

export class Grid<I extends Identifier = Identifier> extends Mutable<GridUpdateDescriptor> {
  public readonly id: I;
  private _name: string;
  private readonly environment: FormulaEnvironment;
  private readonly parent?: Grid;
  private readonly disableCoordinateSystemColumn: boolean;
  // FIXME should be private
  public readonly getPrimitiveDrawing?: (cells: RODictionary<Value>) => Drawing;

  public readonly columns: GridColumns;
  public readonly rows: Rows;
  public readonly valueNamespace: ValueNamespace;
  public readonly gridConstructor: Constructor<I>;

  constructor(
    updateManager: UpdateManager,
    {disableCoordinateSystemColumn, environment, getPrimitiveDrawing, name, newColumns, parentGrid}: GridData,
    modelType: ModelType = ModelType.GRID,
  ) {
    super(updateManager, modelType);
    this._name = name;
    this.environment = environment;
    this.disableCoordinateSystemColumn = !!disableCoordinateSystemColumn;
    this.getPrimitiveDrawing = getPrimitiveDrawing || (parentGrid && parentGrid.getPrimitiveDrawing);
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForUpdate(this, this.onParentGridUpdated);
    }

    // configure grid enough to add to formula environment
    this.valueNamespace = Grid.buildValueNamespace(this.getColumnByName, this.getColumnById);
    this.columns = new FunctionalKeyedArray(updateManager, this.constructInitialColumns(newColumns), 'columnId');

    // add to formula environment
    environment.addGrid(this);

    // finish configuring grid. can now resolve internal references with formula environment.
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.rows = new FunctionalArrayM(updateManager, [this.buildDefaultRow()]);
    this.rows.listenForUpdate(this, this.onRowsUpdated);
    this.gridConstructor = this.buildConstructor();
    this.gridConstructor.listenForUpdate(this, this.onGridConstructorUpdated);
  }

  private get namespace(): Namespace {
    // Avoid environment.getInstanceNamespace(this.type), grid might not be registered in environment yet
    const globalNamespace = this.environment.getGlobalNamespace();
    return new DictNamespace(globalNamespace, this.valueNamespace);
  }

  private constructInitialColumns = (newColumnData: Column[] = []): GridColumn[] => {
    const {parent, namespace} = this;
    const parentColumns = parent ?
      parent.columns.a.map(c => GridColumn.fromParent(c, {namespace, type: c.type})) :
      [];
    const newColumns = newColumnData.map(this.makeGridColumn);
    const systemColumns = this.makeSystemColumns();
    return Grid.defaultsById(parentColumns.concat(newColumns).concat(systemColumns), 'columnId');
  }

  private static defaultsById = <T extends any> (list: T[], id: string): T[] => {
    const defaults: T[] = [];
    const observedIds = {};
    list.forEach(t => {
      const tId = t[id];
      if (!observedIds[tId]) {
        observedIds[tId] = true;
        defaults.push(t);
      }
    });
    return defaults;
  }

  private makeSystemColumns = (): GridColumn[] => {
    const {disableCoordinateSystemColumn, environment, updateManager} = this;
    if (disableCoordinateSystemColumn) {
      return [];
    }
    const c = getCoordinateSystemColumn(updateManager, environment.getGlobalNamespace());
    const coordinateSystemColumn = this.makeGridColumn(c);
    return [coordinateSystemColumn];
  }

  private buildDefaultRow = (): Row => {
    const {columns, environment, id, getPrimitiveDrawing, parent, updateManager} = this;
    return new Row(updateManager, {
      columns,
      defaultValues: parent ? parent.defaultValues : undefined,
      environment,
      getPrimitiveDrawing,
      gridId: id,
      manualValues: {},
    });
  }

  private static buildValueNamespace = (
    getColumnByName: (name: string) => GridColumn | undefined,
    getColumnById: (columnId: string) => GridColumn | undefined,
  ): ValueNamespace => {
    return {
      getValueReferenceByName: (name: string): ValueReference | undefined => {
        const column = getColumnByName(name);
        if (!column) {
          return undefined;
        }
        const {columnId: id, type} = column;
        return new ValueReference(id, type);
      },
      getReferenceName: (ref: ValueReference): string | undefined => {
        const column = getColumnById(ref.id);
        return column && column.name;
      },
    }
  }

  private buildConstructor = (): Constructor<I> => {
    const {columns, defaultValues, environment, getPrimitiveDrawing, id: gridId, valueNamespace: namespace} = this;
    // TODO create a Primitive mutable model and make this.name a Primitive
    const getName = () => this.name;
    return new GridConstructor(this.updateManager, {
      columns, defaultValues, environment, getPrimitiveDrawing, gridId, getName, namespace,
    });
  }

  public get name(): string {
    return this._name;
  }

  public setName = (name: string) => {
    if (!this.environment.getGlobalNamespace().getGridIdByName(name)) {
      this._name = name;
      const descriptor = {type: GridUpdateType.NAME_UPDATED};
      this.onSelfMutated([descriptor]);
    }
  }

  public get value(): GridValue {
    // TODO fix this
    return {type: TypeUtils.GridOf(this.id), dict: {}, list: []};
  }

  public get defaultValues(): Row {
    return this.rows.get(0)!;
  }

  public getDrawing = (): Drawing => {
    return DrawingUtils.listOf(this.rows.a.map(r => r.getDrawing()));
  }

  public writeToAddress = (value: Vector, editor: Address, target: Address) => {
    const [node, address] = editor.unwrapNode();
    if (!AddressUtils.isList(node)) {
      throw new Error("Grid-level address node should always specify a row.");
    }
    this.rows.a[node.index].writeToAddress(value, address, target);
  }

  public isOrExtends = (grid: Grid): boolean => {
    return this === grid || (!!this.parent && this.parent.isOrExtends(grid));
  }

  public getCommonAncestor = (grid: Grid): Grid | undefined => {
    if (grid.isOrExtends(this)) {
      return this;
    }
    return this.parent && this.parent.getCommonAncestor(grid);
  }

  private getColumnByName = (name: string): GridColumn | undefined => {
    return this.columns.a.find(c => c.name === name);
  }

  private getColumnById = (columnId: string): GridColumn | undefined =>  {
      return this.columns.d[columnId];
  }

  public addColumns = (columns: GridColumn[]) => {
    this.columns.pushAll(columns);
  }

  public addNewColumn = (type: Type) => {
    const {updateManager} = this;
    const name = this.getDefaultNameForColumnOfType(type);
    const column = new Column(updateManager, {name, type});
    const gridColumn = this.makeGridColumn(column);
    this.addColumns([gridColumn]);
  }

  private makeGridColumn = (column: Column): GridColumn => {
    const {environment, namespace, updateManager} = this;
    return new GridColumn(updateManager, {
      column,
      environment,
      namespace,
      type: column.type,
      width: DEFAULT_COLUMN_WIDTH,
    });
  }

  private getDefaultNameForColumnOfType = (type: Type): string => {
    const baseName = this.environment.getGlobalNamespace().typeToString(type);
    let i = 1;
    while (true) {
      const name = i === 1 ? baseName : `${baseName} ${i}`;
      if (this.getColumnByName(name) === undefined) {
        return name;
      }
      i++;
    }
  }

  public addRows = (rows: Row[]) => {
    this.rows.pushAll(rows);
  }

  public addNewRow = () => {
    const {columns, defaultValues, environment, getPrimitiveDrawing,
        id, updateManager} = this;
    const row = new Row(updateManager, {
      columns,
      defaultValues,
      environment,
      getPrimitiveDrawing,
      gridId: id,
      manualValues: {},
    });
    this.addRows([row]);
  }

  public getAllowedColumnTypes = (): Array<{name: string, type: Type}> => {
    const types = this.environment.getAllowedColumnTypes().map(type => ({
      name: this.environment.getGlobalNamespace().typeToString(type),
      type,
    }));
    return types;
  }

  private onColumnsUpdated = (
    epoch: number,
    updates: Array<ArrayUD<GridColumnUpdateDescriptor>>,
  ): GridUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    return [{type: GridUpdateType.COLUMNS_UPDATED}];
  }

  private onRowsUpdated = (epoch: number, updates: Array<ArrayUD<RowUpdateDescriptor>>): GridUpdateDescriptor[] => {
    const descriptors: GridUpdateDescriptor[] = [{type: GridUpdateType.ROWS_UPDATED}];
    const defaultValueUpdated = updates.some(u => u.index === 0);
    if (defaultValueUpdated) {
      descriptors.push({type: GridUpdateType.DEFAULT_VALUES_UPDATED});
    }
    this.onDependencyUpdated(epoch);
    return descriptors;
  }

  private onGridConstructorUpdated = (
    epoch: number,
    updates: ConstructorUpdateDescriptor[],
  ): GridUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    const descriptor = {type: GridUpdateType.CONSTRUCTOR_UPDATED};
    return [descriptor];
  }

  private onParentGridUpdated = (epoch: number, updates: GridUpdateDescriptor[]): GridUpdateDescriptor[] => {
    const columnsUpdated = updates.some(u => u.type === GridUpdateType.COLUMNS_UPDATED);
    if (columnsUpdated) {
      // TODO - Need to keep inherited columns in sync with parent's columns
      return [];
    }
    return [];
  }
}