export class EpochManager {
  private _epoch: number = 0;

  public get epoch(): number {
    return this._epoch;
  }

  public nextEpoch = (): number => {
    this._epoch++;
    return this._epoch;
  };
}
