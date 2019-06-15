import * as _ from 'lodash';

import {ValueNamespace} from '@language/reference';
import {TypeUtils} from '@language/types';
import {GridValue} from '@language/values';
import {Constant} from '../core/constant';
import {GridLike} from './grid';

export class BuiltInFormulaGrid extends Constant implements GridLike {
  public readonly name: string;

  private readonly namespace: ValueNamespace;

  constructor(name: string, namespace: ValueNamespace) {
    super();
    this.name = name;
    this.namespace = namespace;
  }

  public get value(): GridValue {
    // TODO this should throw an error. This can be fixed once grid constructors are
    // implementd as models and formula references are updated appropariately.
    // throw new Error("Direct references to formula grids are forbidden.");
    return {type: TypeUtils.GridOf(this.id), dict: {}, list: []};
  }

  public getNamespace = (): ValueNamespace  => {
    return this.namespace;
  }
}
