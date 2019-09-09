import * as _ from 'lodash';

import {COORDINATE_SYSTEM_COLUMN_ID, DRAWING_COLUMN_ID} from '@core/drawing_grid_utilities';
import {ExpressionRes} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {NameResolver, ValueNamespace} from '@language/name_resolver';
import {Parser} from '@language/parser';
import {RelativeValueReference} from '@language/reference';
import {Identifier, Type, TypeUtils} from '@language/types';
import {GridValue} from '@language/values';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from '../collections/functional_array';
import {FunctionalKeyedArray} from '../collections/functional_keyed_array';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {GridUpdateType} from '../core/update_types';
import {Column} from './column';
import {ConstructorUpdateDescriptor, GridConstructor} from './constructor';
import {DEFAULT_COLUMN_WIDTH, GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Row, RowUpdateDescriptor} from './row';

export type GridColumns = FunctionalKeyedArray<GridColumn, GridColumnUpdateDescriptor, 'columnId'>;
export type Rows = FunctionalArrayM<Row, RowUpdateDescriptor>;

export interface CellIndex {
  columnId: string,
  rowIndex: number,
}

export interface GridData {
  formulaEnvironment: FormulaEnvironment;
  name: string,
  parentGrid?: Grid,
  disableDrawingColumn?: boolean;
}

export interface GridUpdateDescriptor extends UpdateDescriptor<GridUpdateType> {}

export class Grid<I extends Identifier = Identifier> extends Mutable<GridUpdateDescriptor> {
  public readonly id: I;
  private _name: string;
  private readonly formulaEnvironment: FormulaEnvironment;
  private readonly parent?: Grid;
  private readonly disableDrawingColumn: boolean;
  public readonly columns: GridColumns;
  public readonly rows: Rows;
  public readonly namespace: ValueNamespace;
  public readonly gridConstructor: GridConstructor<I>;

  constructor(
    updateManager: UpdateManager,
    {disableDrawingColumn, formulaEnvironment, name, parentGrid}: GridData,
    modelType: ModelType = ModelType.GRID,
  ) {
    super(updateManager, modelType);
    this._name = name;
    this.formulaEnvironment = formulaEnvironment;
    this.disableDrawingColumn = !!disableDrawingColumn;
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForUpdate(this, this.onParentGridUpdated);
    }

    // configure grid enough to add to formula environment
    this.columns = new FunctionalKeyedArray(updateManager, this.getDefaultColumns(), 'columnId');
    this.namespace = Grid.buildNamespace(this.getColumnByName, this.getColumnById);

    // add to formula environment
    formulaEnvironment.addGrid(this);

    // finish configuring grid. can now resolve internal references with formula environment.
    this.configureSystemColumns();
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.rows = new FunctionalArrayM(updateManager, [this.buildDefaultRow()]);
    this.rows.listenForUpdate(this, this.onRowsUpdated);
    this.gridConstructor = this.buildConstructor();
    this.gridConstructor.listenForUpdate(this, this.onGridConstructorUpdated);
  }

  private getDefaultColumns = (): GridColumn[] => {
    return this.parent ?
      this.parent.columns.a.map(c => GridColumn.fromParent(c, {grid: this, type: c.type})) :
      this.makeSystemColumns();
  }

  private makeSystemColumns = (): GridColumn[] => {
    const drawingColumn = this.makeGridColumn(Column.getDrawingColumn(this.updateManager));
    if (this.disableDrawingColumn) {
      return [drawingColumn];
    }
    const getGridIdByName = (gridName: string) => this.formulaEnvironment.getGridByName(gridName).id;
    const coordinateSystemColumn = this.makeGridColumn(Column.getCoordinateSystemColumn(this.updateManager, getGridIdByName));
    return [drawingColumn, coordinateSystemColumn];
  }

  private configureSystemColumns = () => {
    this.updateSystemColumns();
  }

  private updateSystemColumns = () => {
    this.updateDrawingColumn();
  }

  private updateDrawingColumn = () => {
    const drawingColumn = this.getDrawingColumn();
    const expression = this.disableDrawingColumn ? 'DrawDrawings()' : this.buildDrawingColumnExpression();
    const ast = this.resolveExpression(expression);
    drawingColumn.setExpression(ast);
  }

  private buildDrawingColumnExpression = (): string => {
    const drawingColumn = this.getDrawingColumn();
    const coordinateSystemColumn = this.getCoordinateSystemColumn();
    const csRefExpr = Parser.identToText(coordinateSystemColumn.name);
    const csExpr = `[${csRefExpr}]`;
    const otherColumns = this.columns.a.filter(c => c !== drawingColumn && c !== coordinateSystemColumn);
    const otherColumnRefExprs = otherColumns.map(c => Parser.identToText(c.name));
    const columnsExpr = `[${otherColumnRefExprs.join(", ")}]`;
    return `DrawDrawings('Coordinate System' = ${csExpr}, Values = ${columnsExpr})`;
  }

  private getDrawingColumn = (): GridColumn => {
    return this.columns.getByKey(DRAWING_COLUMN_ID)!;
  }

  private getCoordinateSystemColumn = (): GridColumn => {
    return this.columns.getByKey(COORDINATE_SYSTEM_COLUMN_ID)!;
  }

  private resolveExpression = (expression: string): ExpressionRes => {
    const resolver = this.formulaEnvironment.nameResolver.resolverWith(this.namespace);
    const parseResult = Parser.parseExpression(expression);
    if (!parseResult.succeeded) {
      throw new Error(`Bad formula: ${expression}`);
    }
    return parseResult.ast.resolve(resolver);
  }

  private buildDefaultRow = (): Row => {
    const {columns, id, parent, updateManager} = this;
    return new Row(updateManager, {
      columns,
      defaultValues: parent ? parent.defaultValues : undefined,
      gridId: id,
      manualValues: {},
    });
  }

  private static buildNamespace = (
    getColumnByName: (name: string) => GridColumn | undefined,
    getColumnById: (columnId: string) => GridColumn | undefined,
  ): ValueNamespace => {
    return {
      getReferenceForName: (name: string): RelativeValueReference | undefined => {
        const column = getColumnByName(name);
        if (!column) {
          return undefined;
        }
        const {columnId: id, type} = column;
        return new RelativeValueReference(id, type, (r: NameResolver) => column.name);
      },
      getNameForReference: (columnId: string): string | undefined => {
        const column = getColumnById(columnId);
        return column && column.name;
      },
    }
  }

  private buildConstructor = (): GridConstructor<I> => {
    const {columns, defaultValues, id: gridId, namespace} = this;
    // TODO create a Primitive mutable model and make this.name a Primitive
    const getName = () => this.name;
    return new GridConstructor(this.updateManager, {columns, defaultValues, gridId, getName, namespace});
  }

  public get name(): string {
    return this._name;
  }

  public get value(): GridValue {
    // TODO fix this
    return {type: TypeUtils.GridOf(this.id), dict: {}, list: []};
  }

  public get defaultValues(): Row {
    return this.rows.get(0)!;
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
    this.updateSystemColumns();
  }

  public addNewColumn = (type: Type) => {
    const {updateManager} = this;
    const name = this.getDefaultNameForColumnOfType(type);
    const column = new Column(updateManager, {name, type});
    const gridColumn = this.makeGridColumn(column);
    this.addColumns([gridColumn]);
  }

  private makeGridColumn = (column: Column): GridColumn => {
    const {formulaEnvironment, updateManager} = this;
    return new GridColumn(updateManager, {
      column,
      formulaEnvironment,
      grid: this,
      type: column.type,
      width: DEFAULT_COLUMN_WIDTH,
    });
  }

  private getDefaultNameForColumnOfType = (type: Type): string => {
    const baseName = this.formulaEnvironment.getNameForType(type);
    let i = 1;
    while (true) {
      const name = `${baseName} ${i}`;
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
    const {columns, defaultValues, id, updateManager} = this;
    const row = new Row(updateManager, {
      columns,
      defaultValues,
      gridId: id,
      manualValues: {},
    });
    this.addRows([row]);
  }

  public getAllowedColumnTypes = (): Array<{name: string, type: Type}> => {
    const types = this.formulaEnvironment.getAllowedColumnTypes().map(type => ({
      name: this.formulaEnvironment.getNameForType(type),
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