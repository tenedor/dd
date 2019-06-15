import * as _ from 'lodash';
import * as React from 'react';

import {ModelType} from '@core/models/model';
import {Mutable} from '@core/models/mutable';
import {SimpleUpdateManager, UpdateDescriptor} from '@core/models/update_manager';
import {AppUpdateType} from '@core/models/update_types';
import {Document, DocumentUpdateDescriptor} from '@models/document';
import {DocumentView} from '@views/document_view';

export interface AppUpdateDescriptor extends UpdateDescriptor<AppUpdateType> {}

export class App extends Mutable {
  private document: Document;
  private documentRef?: DocumentView;

  constructor(modelType: ModelType = ModelType.APP) {
    super(new SimpleUpdateManager(), modelType);
    this.document = new Document(this.updateManager);
    this.document.listenForUpdate(this, this.onDocumentUpdated);
    this.document.loadBuiltInFormulas();
    this.document.addBuiltInGrids();
  }

  private onDocumentUpdated = (epoch: number, updates: DocumentUpdateDescriptor[]) => {
    if (this.documentRef) {
      this.documentRef.forceUpdate();
    }

    this.onDependencyUpdated(epoch);
    return [{type: AppUpdateType.DOCUMENT_UPDATED}];
  }

  public renderApplication = () => {
    const {document, epoch} = this;
    return (
      <DocumentView ref={r => this.documentRef = r ? r : undefined} epoch={epoch} document={document} />
    );
  }
}
