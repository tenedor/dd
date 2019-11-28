interface DragState {
  dragOrigin: MouseEvent,
  isDragging: boolean,
}

export interface DragListener {
  onDragStart?: (mousedown: MouseEvent) => void,
  onDragMove?: (mousemove: MouseEvent, originMousedown: MouseEvent) => void,
  onDragRelease?: (mouseup: MouseEvent) => void,
  onDragCancel?: () => void,
  onMouseupNeverDragged?: (mouseup: MouseEvent) => void,
}

export class MouseMoveManager {
  private initialized = false;
  private mouseIsDown = false;
  private dragState?: DragState;
  private dragListener?: DragListener;

  public onDocumentReady = () => {
    if (this.initialized) {
      return;
    }

    document.addEventListener('mousedown', this.onMousedown, false);
    document.addEventListener('mouseup', this.onMouseup, false);
    this.initialized = true;
  }

  public teardown = () => {
    document.removeEventListener('mousedown', this.onMousedown, false);
    document.removeEventListener('mouseup', this.onMouseup, false);
    this.initialized = false;
  }

  public isMouseDown = (): boolean => {
    return this.mouseIsDown;
  }

  public setDragListener = (dragListener: DragListener) => {
    // Mouse tracking consistency may be disturbed by out-of-window mouse events, in
    // which case the owner of the previous listener may believe its drag is still in
    // progress and have failed to clear its listener. Defend against this by clearing
    // the drag state.
    this.clearDragIfAny();
    if (this.dragListener !== undefined) {
      // For now there is no need for multiple listeners so do not allow it.
      throw new Error("Cannot have multiple drag listeners simultaneously.");
    }
    this.dragListener = dragListener;
  }

  // The object that set the listener is responsible for clearing it when it is done
  // to make room for another object to listen.
  public clearDragListener = (dragListener: DragListener) => {
    if (this.dragListener !== dragListener) {
      throw new Error("Illegal attempt to clear listener that was not set.");
    }
    this.stopWatchingDragEvents();
    this.dragListener = undefined;
  }

  // Use this method if there is a need to clear someone else's drag listener because
  // they were unable to discover , e.g. if mouse tracking consistency is disturbed by out-of-window
  // mouse events.
  private clearDragIfHanging = () => {
    this.clearDragIfAny();
  }

  private onMousedown = (e: MouseEvent) => {
    this.mouseIsDown = true;
    if (this.dragListener) {
      this.watchDragEvents(e)
    }
  }

  private onMouseup = (e: MouseEvent) => {
    this.mouseIsDown = false;
    if (this.dragState && this.dragState.isDragging) {
      this.onDragRelease(e);
    } else {
      this.onMouseupNeverDragged(e);
    }
    this.stopWatchingDragEvents();
  }

  private onMousemove = (e: MouseEvent) => {
    if (this.dragState === undefined) {
      return;
    }
    const {dragOrigin, isDragging} = this.dragState;
    if (!isDragging) {
      this.onDragStart(e);
      this.dragState = {dragOrigin, isDragging: true};
    }
    this.onDragMove(e, this.dragState.dragOrigin);
  }

  public clearDragIfAny = () => {
    if (this.dragState && this.dragState.isDragging) {
      this.onDragCancel();
    }
    this.stopWatchingDragEvents();
  }

  private watchDragEvents = (e: MouseEvent) => {
    this.clearDragIfAny();
    document.addEventListener('mousemove', this.onMousemove, false);
    this.dragState = {dragOrigin: e, isDragging: false};
  }

  private stopWatchingDragEvents = () => {
    document.removeEventListener('mousemove', this.onMousemove, false);
    this.dragState = undefined;
  }

  private onDragStart = (mousedown: MouseEvent) => {
    if (this.dragListener === undefined) {
      throw new Error("Expected drag listener to be defined");
    }
    const {onDragStart} = this.dragListener;
    if (onDragStart) {
      onDragStart(mousedown);
    }
  }

  private onDragMove = (mousemove: MouseEvent, originMousedown: MouseEvent) => {
    if (this.dragListener === undefined) {
      throw new Error("Expected drag listener to be defined");
    }
    const {onDragMove} = this.dragListener;
    if (onDragMove) {
      onDragMove(mousemove, originMousedown);
    }
  }

  private onDragRelease = (mouseup: MouseEvent) => {
    if (this.dragListener === undefined) {
      throw new Error("Expected drag listener to be defined");
    }
    const {onDragRelease} = this.dragListener;
    if (onDragRelease) {
      onDragRelease(mouseup);
    }
  }

  private onDragCancel = () => {
    if (this.dragListener === undefined) {
      throw new Error("Expected drag listener to be defined");
    }
    const {onDragCancel} = this.dragListener;
    if (onDragCancel) {
      onDragCancel();
    }
  }

  private onMouseupNeverDragged = (mouseup: MouseEvent) => {
    if (this.dragListener && this.dragListener.onMouseupNeverDragged) {
      this.dragListener.onMouseupNeverDragged(mouseup);
    }
  }
}