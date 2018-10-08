export function assert(e: any, message?: string): true {
  if (!e) {
    throw new Error(message);
  }
  return true;
}
