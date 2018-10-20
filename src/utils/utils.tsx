export function assert(e: any, message?: string): true {
  if (!e) {
    throw new Error(message);
  }
  return true;
}

interface ClassNameMap {
  [className: string]: boolean,
};

export function classNames(...args: Array<string | ClassNameMap>): string {
  const stringArgs = args.filter(a => typeof a === "string") as string[];
  const stringClasses = stringArgs;

  const mapArgs = args.filter(a => typeof a === "object") as ClassNameMap[];
  const mapArg = Object.assign.apply(null, [{}].concat(mapArgs)) as ClassNameMap;
  const mapClasses = Object.keys(mapArg).filter(c => mapArg[c]);

  const classes = stringClasses.concat(mapClasses);
  return classes.join(" ");
}