import * as _ from 'lodash';
import * as React from 'react';

import {ModelType} from '@models/core/model';
import {Mutable} from '@models/core/mutable';
import {SimpleUpdateManager, UpdateDescriptor} from '@models/core/update_manager';
import {AppUpdateType} from '@models/core/update_types';
import {Document, DocumentUpdateDescriptor} from '@models/domain_specific/document';
import {AppView} from '@views/app_view';
import {ConsoleUI} from './console_ui';

export interface AppUpdateDescriptor extends UpdateDescriptor<AppUpdateType> {}

export class App extends Mutable {
  private readonly document: Document;
  private readonly consoleUI: ConsoleUI;
  private appViewRef?: AppView;

  constructor(modelType: ModelType = ModelType.APP) {
    super(new SimpleUpdateManager(), modelType);
    this.document = new Document(this.updateManager);
    this.consoleUI = new ConsoleUI(this.document, "dd");
    (window as any).dd = this.consoleUI;

    // App is the top-level model so it self-initializes
    this.init();
  }

  protected initInner(): void {
    super.initInner();
    this.document.listenForUpdate(this, this.onDocumentUpdated);
    this.document.addDemoGrids();
    this.consoleUI.init();
  }

  private onDocumentUpdated = (epoch: number, updates: DocumentUpdateDescriptor[]) => {
    if (this.appViewRef) {
      this.appViewRef.forceUpdate();
    }

    this.onDependencyUpdated(epoch);
    return [{type: AppUpdateType.DOCUMENT_UPDATED}];
  }

  public renderApplication = () => {
    const {document, epoch} = this;
    return (
      <AppView ref={r => this.appViewRef = r ? r : undefined} epoch={epoch} document={document} />
    );
  }
}
