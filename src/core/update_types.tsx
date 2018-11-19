// TypeScript does not allow extensible enums, see: https://github.com/Microsoft/TypeScript/issues/17592.
// In its place, use the hack proposed in: https://github.com/Microsoft/TypeScript/issues/17592#issuecomment-375968511.

export const UndefinedUpdateType = {
  UNDEFINED: "UNDEFINED" as "UNDEFINED",
};
export type UndefinedUpdateType = (typeof UndefinedUpdateType)[keyof typeof UndefinedUpdateType];

export const ArrayUpdateType = {
  ELEMENT_DELETED: "ELEMENT_DELETED" as "ELEMENT_DELETED",
  ELEMENT_INSERTED: "ELEMENT_INSERTED" as "ELEMENT_INSERTED",
  ELEMENT_UPDATED: "ELEMENT_UPDATED" as "ELEMENT_UPDATED",
};
export type ArrayUpdateType = (typeof ArrayUpdateType)[keyof typeof ArrayUpdateType];

export const DictionaryUpdateType = {
  KEY_DELETED: "KEY_DELETED" as "KEY_DELETED",
  KEY_SET: "KEY_SET" as "KEY_SET",
  KEY_UPDATED: "KEY_UPDATED" as "KEY_UPDATED",
};
export type DictionaryUpdateType = (typeof DictionaryUpdateType)[keyof typeof DictionaryUpdateType];

export const ColumnUpdateType = {
  NAME_UPDATED: "NAME_UPDATED" as "NAME_UPDATED",
};
export type ColumnUpdateType = (typeof ColumnUpdateType)[keyof typeof ColumnUpdateType];

export const GridColumnUpdateType = {
  FORMULA_UPDATED: "FORMULA_UPDATED" as "FORMULA_UPDATED",
  NAME_UPDATED: "NAME_UPDATED" as "NAME_UPDATED",
  WIDTH_UPDATED: "WIDTH_UPDATED" as "WIDTH_UPDATED",
};
export type GridColumnUpdateType = (typeof GridColumnUpdateType)[keyof typeof GridColumnUpdateType];

export const RowUpdateType = {
  CELL_UPDATED: "CELL_UPDATED" as "CELL_UPDATED",
};
export type RowUpdateType = (typeof RowUpdateType)[keyof typeof RowUpdateType];

export const GridUpdateType = {
  COLUMN_UPDATED: "COLUMN_UPDATED" as "COLUMN_UPDATED",
  DEFAULT_VALUES_UPDATED: "DEFAULT_VALUES_UPDATED" as "DEFAULT_VALUES_UPDATED",
  FIRST_ROW_UPDATED: "FIRST_ROW_UPDATED" as "FIRST_ROW_UPDATED",
  NAME_UPDATED: "NAME_UPDATED" as "NAME_UPDATED",
  ROW_UPDATED: "ROW_UPDATED" as "ROW_UPDATED",
}
export type GridUpdateType = (typeof GridUpdateType)[keyof typeof GridUpdateType];

export const DocumentUpdateType = {
  GRID_UPDATED: "GRID_UPDATED" as "GRID_UPDATED",
};
export type DocumentUpdateType = (typeof DocumentUpdateType)[keyof typeof DocumentUpdateType];


export type UpdateType =
  UndefinedUpdateType |
  ArrayUpdateType |
  DictionaryUpdateType |
  ColumnUpdateType |
  GridColumnUpdateType |
  RowUpdateType |
  GridUpdateType |
  DocumentUpdateType;
