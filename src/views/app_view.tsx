import * as _ from 'lodash';
import * as React from 'react';

import {Document} from '@models/domain_specific/document';
import {BaseComponent, BaseProps} from './base_component';
import {DocumentView} from './document_view';
import {UIGlobals} from './ui_globals';

interface Props extends BaseProps {
  document: Document,
}

export class AppView extends BaseComponent<Props> {
  private uiGlobals: UIGlobals;

  constructor(props: Props) {
    super(props);
    this.uiGlobals = new UIGlobals();
  }

  public componentDidMount() {
    this.uiGlobals.onDocumentReady();
  }

  public componentWillUnmount() {
    this.uiGlobals.teardown();
  }

  public render = () => {
    const {document, epoch} = this.props;
    const {uiGlobals} = this;
    return (
      <DocumentView epoch={epoch} document={document} uiGlobals={uiGlobals} />
    );
  }
}
