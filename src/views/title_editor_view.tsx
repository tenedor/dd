import * as _ from 'lodash';
import * as React from 'react';

import {KeyCode} from '@utils/keycode';
import {assert, classNames} from '@utils/utils';
import {BaseComponent, BaseProps} from './base_component';

interface Props extends BaseProps {
  onSetTitle: (title: string) => void,
  title: string,
}

interface State {
  isEditing: boolean,
}

export class TitleEditorView extends BaseComponent<Props, State> {
  private textInputRef?: HTMLInputElement;

  constructor(props: Props) {
    super(props);

    this.state = {
      isEditing: false,
    };
  }

  public componentDidUpdate() {
    if (!this.state.isEditing) {
      this.updateDisplayValue();
    }
  }

  private setIsEditing = (isEditing: boolean) => {
    this.setState({isEditing});
  }

  public render = () => {
    const {title} = this.props;
    const className = classNames("title-editor-view", {
      editing: this.state.isEditing,
    });
    return (
      <div className={className} tabIndex={0} onKeyDown={this.onKeyDown} onMouseDown={this.onMouseDown} >
        <input type="text" size={100} ref={r => this.textInputRef = r || undefined} defaultValue={title} />
      </div>
    );
  }

  private updateDisplayValue = () => {
    const {title} = this.props;
    this.setDisplayValue(title);
  }

  private setDisplayValue = (value: string) => {
    this.textInputRef!.value = value;
  }

  private startEditing = () => {
    assert(!this.state.isEditing);
    this.setIsEditing(true);
    this.updateDisplayValue();
  }

  private stopEditing = () => {
    this.setIsEditing(false);
  }

  // Set the title. This always shifts the editor to not-editing.
  private setValue(value: string) {
    this.props.onSetTitle(value);
    this.stopEditing();
  }

  private persistValue() {
    this.setValue(this.textInputRef!.value);
  }

  private onMouseDown = (e: React.MouseEvent) => {
    const {isEditing} = this.state;
    if (!isEditing) {
      this.startEditing();
      e.preventDefault();
    }
    e.stopPropagation();
  }

  private onKeyDown = (e: React.KeyboardEvent) => {
    const {isEditing} = this.state;
    const {keyCode} = e;

    switch (keyCode) {
      case KeyCode.ENTER:
        if (isEditing) {
          this.persistValue();
        }
        e.preventDefault();
        return;

      case KeyCode.ESCAPE:
        if (isEditing) {
          this.stopEditing();
          e.stopPropagation();
        }
        e.preventDefault();
        return;
    }
  }
}