import * as _ from 'lodash';
import * as React from 'react';

import {Document} from '@models/document';
import {generateUID} from '@utils/utils';
import {DocumentView} from '@views/document_view';

export class App {
  public readonly id: string;
  private epoch: number;
  private document: Document;
  private documentRef?: DocumentView;

  constructor() {
    this.id = generateUID('app');
    this.document = new Document();
    this.epoch = this.document.epoch;
    this.document.listenForUpdate(this.id, this.onEpochUpdated);
    this.document.loadBuiltInFormulas();
    this.document.addBuiltInGrids();
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
