import {Identifier} from '@core/language/types';
import {ROArray} from '@utils/types';
import {assert, assertUnreachable, deepEqual, splitEscapedString} from '@utils/utils';

export enum EncodingChar {
  TYPE = ":",
  PATH = "/",
  NAMESPACE = "::",
  ESCAPE = "\\",
}

enum AddressNodeType {
  GROUP = "GROUP",
  LIST = "LIST",
}

interface GroupAddressNode {
  type: AddressNodeType.GROUP,
  id: Identifier,
}

interface ListAddressNode {
  type: AddressNodeType.LIST,
  index: number,
}

export type AddressNode = GroupAddressNode | ListAddressNode;


export class Address {
  private readonly address: ROArray<AddressNode>;

  constructor(address: ROArray<AddressNode>) {
    this.address = address;
  }

  public isEmpty = (): boolean => {
    return this.address.length === 0;
  }

  public getDepth = (): number => {
    return this.address.length;
  }

  public addNode = (node: AddressNode): Address => {
    return new Address(this.address.concat(node));
  }

  public addGroup = (columnId: Identifier): Address => {
    return this.addNode(AddressUtils.groupOf(columnId));
  }

  public addList = (index: number): Address => {
    return this.addNode(AddressUtils.listOf(index));
  }

  public wrapInNode = (node: AddressNode): Address => {
    return new Address([node].concat(...this.address));
  }

  public wrapInGroup = (columnId: Identifier): Address => {
    return this.wrapInNode(AddressUtils.groupOf(columnId));
  }

  public wrapInList = (index: number): Address => {
    return this.wrapInNode(AddressUtils.listOf(index));
  }

  public unwrapNode = (): [AddressNode, Address] => {
    const poppedNode = this.address[0];
    const rest = this.address.slice(1);
    return [poppedNode, new Address(rest)];
  }

  public encodeAsString = (): string => {
    return this.address.map(Address.encodeNodeAsString).join(EncodingChar.PATH);
  }

  public static parseFromString = (address: string): Address => {
    const nodes = splitEscapedString(address, EncodingChar.PATH, EncodingChar.ESCAPE)
        .map(Address.parseNodeFromString);
    return new Address(nodes);
  }

  private static encodeNodeAsString = (n: AddressNode): string => {
    switch (n.type) {
      case AddressNodeType.GROUP:
        return [n.type, n.id].join(EncodingChar.TYPE);
      case AddressNodeType.LIST:
        return [n.type, n.index].join(EncodingChar.TYPE);
      default:
        return assertUnreachable(n);
    }
  }

  private static parseNodeFromString = (node: string): AddressNode => {
    const parts = splitEscapedString(node, EncodingChar.TYPE, EncodingChar.ESCAPE);
    assert(parts.length === 2, `Invalid address node string: ${node}`);
    const type = parts[0] as AddressNodeType;
    assert(Object.values(AddressNodeType).includes(type),
        `Invalid type in address node string: ${parts[0]}`);
    switch (type) {
      case AddressNodeType.GROUP:
        return {type, id: parts[1]};
      case AddressNodeType.LIST:
        const index = parseInt(parts[1], 10);
        assert(index >= 0, `Invalid index in list address node string: ${parts[1]}`);
        return {type, index: parseInt(parts[1], 10)};
      default:
        return assertUnreachable(type);
    }
  }

  public equals = (other: Address): boolean => {
    return deepEqual(this.address, other.address);
  }
}


export class AddressUtils {

  // ============
  // Constructors
  // ============

  public static groupOf = (columnId: Identifier): GroupAddressNode => ({
    type: AddressNodeType.GROUP, id: columnId,
  })

  public static listOf = (index: number): ListAddressNode => ({
    type: AddressNodeType.LIST, index,
  })


  // ===========
  // Type Guards
  // ===========

  public static isGroup = (node: AddressNode): node is GroupAddressNode => node.type === AddressNodeType.GROUP
  public static isList = (node: AddressNode): node is ListAddressNode => node.type === AddressNodeType.LIST
}