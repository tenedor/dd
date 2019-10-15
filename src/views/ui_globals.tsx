import {MouseMoveManager} from './mouse_move_manager';

export class UIGlobals {
  public readonly mouseMoveManager: MouseMoveManager;

  constructor() {
    this.mouseMoveManager = new MouseMoveManager();
  }

  public onDocumentReady = () => {
    this.mouseMoveManager.onDocumentReady();
  }

  public teardown = () => {
    this.mouseMoveManager.teardown();
  }
}