import * as _ from 'lodash';
import * as React from 'react';
import {Document} from './core/document';
import {Namespace, Resolver} from './core/resolver';
import {DocumentView} from './views/document_view';

export class App {
  public readonly id: string;
  private epoch: number;
  private document: Document;
  private documentRef?: DocumentView;

  constructor() {
    this.id = Resolver.generateUID(Namespace.APP);
    this.document = new Document();
    this.document.listenForEpochUpdate(this.id, this.onEpochUpdated);
    this.document.createGrid();
  }

  private onEpochUpdated = (epoch: number) => {
    this.epoch = epoch;
    if (this.documentRef) {
      this.documentRef.forceUpdate();
    }
  }

  public renderApplication = () => {
    const {document, epoch} = this;
    return (
      <DocumentView ref={r => this.documentRef = r ? r : undefined} epoch={epoch} document={document} />
    );
  }
}
