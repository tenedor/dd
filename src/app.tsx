import * as _ from 'lodash';
import * as React from 'react';
import {Document} from './core/document';
import {DocumentView} from './views/document_view';

export class App {
  private epoch: number;
  private document: Document;
  private documentRef?: DocumentView;

  constructor() {
    this.document = new Document();
    this.document.listenForEpochUpdate(this.onEpochUpdated);
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
