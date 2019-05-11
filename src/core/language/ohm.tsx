import * as Ohm from 'ohm-js';

// tslint:disable-next-line
declare namespace OhmTS {
  function grammarsFromScriptElements(
    nodeList?: NodeList,
    namespace?: Ohm.Namespace): Ohm.Namespace;

  type Namespace = Ohm.Namespace;
}

// re-export ohm with corrected types
export const ohm = Ohm as (typeof Ohm & typeof OhmTS);
export type Node = Ohm.Node;
export type Grammar = Ohm.Grammar;
export type Semantics = Ohm.Semantics;