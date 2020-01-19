import * as _ from 'lodash';

import {CoordinateSystem, GeometryUtils, Position} from '@core/geometry';
import {Address, AddressNode, AddressUtils, EncodingChar} from '@paths/address';
import {ROArray} from '@utils/types';
import {assert, assertUnreachable, splitEscapedString} from '@utils/utils';
import {Drawing, DrawingUtils} from './drawing';

export enum AffordanceType {
  DRAG_POINT = "DRAG_POINT",
}

interface BaseAffordance<T extends AffordanceType> {
  readonly type: T,
  relativeAddr: Address,
  initialPosition: Position,
  name: string,
}

type DragPoint = BaseAffordance<AffordanceType.DRAG_POINT>;

export type Affordance = DragPoint;

export interface WrappedAffordance {
  affordance: Affordance,
  ancestry: Address,
  transform: CoordinateSystem,
}


export class WrappedAffordanceId {
  public readonly ancestry: Address;
  public readonly name: string;

  constructor(ancestry: Address, name: string) {
    this.ancestry = ancestry;
    this.name = name;
  }

  public static buildFromAffordance = (affordance: WrappedAffordance): WrappedAffordanceId => {
    return new WrappedAffordanceId(affordance.ancestry, affordance.affordance.name);
  }

  public encodeAsString = (): string => {
    return [this.ancestry.encodeAsString(), this.name].join(EncodingChar.NAMESPACE);
  }

  public static parseFromString = (addressId: string): WrappedAffordanceId => {
    const parts = splitEscapedString(addressId, EncodingChar.NAMESPACE, EncodingChar.ESCAPE);
    assert(parts.length === 2, `Invalid wrapped affordance id string: ${addressId}`);
    const ancestry = Address.parseFromString(parts[0]);
    const name = parts[1];
    return new WrappedAffordanceId(ancestry, name);
  }

  public equals = (other: WrappedAffordanceId): boolean => {
    return this.ancestry.equals(other.ancestry) && this.name === other.name;
  }
}


export class AffordanceUtils {

  // ============
  // Constructors
  // ============

  public static dragPointOf = (relativeAddr: Address, initialPosition: Position, name: string): DragPoint => ({
    type: AffordanceType.DRAG_POINT, relativeAddr, initialPosition, name
  })

  public static wrapAffordance = (
    affordance: Affordance, ancestry: Address, transform: CoordinateSystem,
  ): WrappedAffordance => ({affordance, ancestry, transform})

  public static wrapAffordanceSimple = (affordance: Affordance): WrappedAffordance =>
      AffordanceUtils.wrapAffordance(affordance, new Address([]), GeometryUtils.defaultCoordinateSystem)


  // =========
  // Utilities
  // =========

  public static extractTransformedAffordances = (drawing: Drawing): ROArray<WrappedAffordance> => {
    if (DrawingUtils.isPrimitive(drawing)) {
      return [];
    } else if (DrawingUtils.isGroup(drawing)) {
      const childAffordances = _.flatMap(drawing.drawings, (d, id) =>
          AffordanceUtils.extractChild(d, AddressUtils.groupOf(id)));
      const localAffordances = drawing.affordances.map(AffordanceUtils.wrapAffordanceSimple);
      const all = [...localAffordances, ...childAffordances];
      return all.map(a => AffordanceUtils.transform(a, drawing.transform));
    } else if (DrawingUtils.isList(drawing)) {
      return _.flatMap(drawing.drawings, (d, index) =>
          AffordanceUtils.extractChild(d, AddressUtils.listOf(index)));
    } else {
      return assertUnreachable(drawing);
    }
  }

  private static extractChild = (drawing: Drawing, addrNode: AddressNode): ROArray<WrappedAffordance> => {
    const affordances = AffordanceUtils.extractTransformedAffordances(drawing);
    return affordances.map(a => _.extend({}, a, {ancestry: a.ancestry.wrapInNode(addrNode)}));
  }

  private static transform = (affordance: WrappedAffordance, transform: CoordinateSystem): WrappedAffordance => {
    const composed = GeometryUtils.composeCoordinateSystems(transform, affordance.transform);
    return _.extend({}, affordance, {transform: composed});
  }
}