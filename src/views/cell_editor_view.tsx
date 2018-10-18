import * as _ from 'lodash';
import * as React from 'react';
import {Value} from '../core/grid';
import {KeyCode} from '../utils/keycode';
import {BaseComponent} from './base_component';

interface Props {
  editable: boolean,
  value: Value,
  onChangeValue: (newValue: string) => void,
}

interface State {
  isEditing: boolean,
}

export class CellEditorView extends BaseComponent<Props, State> {
  private textAreaRef: any;

  constructor(props: Props) {
    super(props);

    this.state = {
      isEditing: false,
    };
  }

  public render = () => {
    const {value} = this.props.value;
    const {isEditing} = this.state;
    const className = "cell-editor-view" + (isEditing ? " editing" : "");
    return (
      <div className={className} tabIndex={0} onKeyDown={this.onKeyDown} >
        <textarea autoFocus={true} ref={r => this.textAreaRef = r} defaultValue={value} />
      </div>
    );
  }

  private submitValue = () => {
    this.props.onChangeValue(this.textAreaRef.value);
  }

  private onKeyDown = (e: React.KeyboardEvent) => {
    if (!this.props.editable) {
      return;
    }

    const {value} = this.props.value;
    const {isEditing} = this.state;
    const {keyCode} = e;

    switch (keyCode) {
      case KeyCode.ENTER:
      case KeyCode.TAB:
        if (isEditing) {
          this.setState({isEditing: false});
          this.submitValue();
        }
        e.preventDefault();
        return;

      case KeyCode.ESCAPE:
        if (isEditing) {
          this.setState({isEditing: false});
          this.textAreaRef.value = value;
          e.stopPropagation();
        }
        e.preventDefault();
        return;

      case KeyCode.SPACE:
        if (!isEditing) {
          this.setState({isEditing: true});
          e.preventDefault();
        }
        e.stopPropagation();
        return;

      case KeyCode.BACKSPACE:
      case KeyCode.DELETE:
        if (!isEditing) {
          e.preventDefault();
          this.textAreaRef.value = "";
          this.submitValue();
        }
        e.stopPropagation();
        return;

      case KeyCode.ARROW_DOWN:
      case KeyCode.ARROW_UP:
      case KeyCode.ARROW_LEFT:
      case KeyCode.ARROW_RIGHT:
        if (isEditing) {
          // let textarea handle it, don't bubble
          e.stopPropagation();
        } else {
          // bubble, don't let textarea handle it
          e.preventDefault();
        }
        return;

      case KeyCode.EQUAL_SIGN:
        if (!isEditing) {
          e.preventDefault();
          // TODO - initiate formula builder
          console.log("begin formula editing");
        }
        e.stopPropagation();
        return;

      default:
        if (
          (KeyCode["0"] <= keyCode && keyCode <= KeyCode.Z) ||
          (KeyCode.NUMPAD_MULTIPLY <= keyCode && keyCode <= KeyCode.NUMPAD_DIVIDE) ||
          (KeyCode.SEMICOLON <= keyCode && keyCode <= KeyCode.QUOTE)
        ) {
          if (!isEditing) {
            this.textAreaRef.value = "";
            this.setState({isEditing: true});
          }
          e.stopPropagation();
          return;
        }
    }
  }
}