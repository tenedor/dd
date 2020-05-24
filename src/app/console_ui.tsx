import * as _ from 'lodash';

import {FormulaEnvironment} from '@language/formula_environment';
import {Type} from '@language/types';
import {Value, ValueUtils} from '@language/values';
import {UpdateDescriptor} from '@models/core/update_manager';
import {AppUpdateType} from '@models/core/update_types';
import {Signature} from '@models/domain_specific/constructor';
import {Document} from '@models/domain_specific/document';

export interface AppUpdateDescriptor extends UpdateDescriptor<AppUpdateType> {}

// styles
const style = (() => {
  // colors
  const black = 'color: #000;';
  const darkGray = 'color: #666;';
  const gray = 'color: #999;';
  const brightGreen = 'color: #0A1;';
  const green = 'color: #008000;';
  const aqua = 'color: #099;';
  const blue = 'color: #06F;';
  const magenta = 'color: #A000BD;';

  // other primitives
  const h1Size = 'font-size: 16px;';
  const h2Size = 'font-size: 14px;';
  const bold = 'font-weight: 700;';
  const italics = 'font-style: italic;';
  const proseFont = 'font-family: sans-serif;';
  const halfLineSpace = 'margin-bottom: 8px;';

  // configurations
  const title = `${brightGreen} ${bold} ${proseFont}`;
  const prose = `${darkGray} ${proseFont}`;
  const code = `${blue} ${bold}`;
  const lineBreak = `${halfLineSpace}`;
  const h1Title = `${h1Size} ${title}`;
  const h1Prose = `${h1Size} ${prose}`;
  const h1Code = `${h1Size} ${code}`;
  const h2Title = `${h2Size} ${title}`;
  const h2Prose = `${h2Size} ${prose}`;
  const h2Code = `${h2Size} ${code}`;
  const fnName = `${code}`;
  const paramName = `${green}`;
  const paramDefault = `${aqua} ${italics}`;
  const paramType = `${gray}`;
  const returnType = `${magenta}`;
  const punctuation = `${black}`;
  const consoleSignature = `${code}`;
  const consoleDescription = `${darkGray}`;

  return {
    title, prose, code, lineBreak, h1Title, h1Prose, h1Code, h2Title, h2Prose, h2Code,
    fnName, paramName, paramDefault, paramType, returnType, punctuation,
    consoleSignature, consoleDescription,
  };
})();

interface FormatString {
  str: string,
  formats: string[],
}

interface ConsoleMethodDocumentation {
  signature: string,
  description: string,
}

const consoleDocumentation: ConsoleMethodDocumentation[] = [{
  signature: 'languageReference(verbosity: string = "vvv")',
  description: 'Print formula language signatures. Specify "", "v", "vv", or "vvv" to control verbosity.',
}, {
  signature: 'help()',
  description: 'Print this help message.',
}];


// Keep these functions out of the UI. All access is public in the console.
class Helper {

  // the variable name used in the console to access the console UI
  private static varName: string;

  public static setVarName = (varName: string) => {
    Helper.varName = varName;
  }

  public static printWelcome = () => {
    const {h1Title, h1Prose, h1Code} = style;
    const {varName} = Helper;
    console.log(
      `%c\nWelcome!%c\nType %c${varName}%c to access the console UI. See %c${varName}.help()%c for details.`,
      h1Title, h1Prose, h1Code, h1Prose, h1Code, h1Prose);
  }

  public static printHelp = () => {
    const {h2Prose, h2Code, lineBreak, consoleSignature, consoleDescription} = style;
    const {varName} = Helper;
    const docStringsArr = consoleDocumentation.map(d => ({
      str: `%c${d.signature}%c: %c${d.description}`,
      formats: [consoleSignature, consoleDescription, `${consoleDescription} ${lineBreak}`],
    }));
    const docStrings = {
      str: docStringsArr.map(d => d.str).join('\n'),
      formats: _.flatMap(docStringsArr, d => d.formats),
    }
    console.log(
      `%c${varName}%c reference:\n${docStrings.str}`,
      h2Code, `${h2Prose} ${lineBreak}`, ...docStrings.formats);
  }

  public static printSignatures = (environment: FormulaEnvironment, verbosity: number) => {
    const signatures = environment.getSignatures();
    const typeToString = (t: Type) => environment.getNameForType(t, {eraseBoundingTypes: true});
    const valueToString = (v: Value) => ValueUtils.toString(v, environment.nameResolver, {quoteStrings: true});
    const formatStrings = signatures.map(s => Helper.printSignatureWithColors(s, typeToString, valueToString, verbosity));
    const str = formatStrings.map(s => s.str).join("\n");
    const formats = _.flatMap(formatStrings, s => s.formats);
    console.log(str, ...formats);
  }

  private static printSignatureWithColors = (signature: Signature, typeToString: (t: Type) => string,
      valueToString: (v: Value) => string, verbosity: number): FormatString => {
    const {fnName, paramName, paramDefault, paramType, returnType, punctuation: punc, lineBreak} = style;

    const params = signature.parameters.map(p => {
      if (verbosity < 1) {
        return `%c${p.name}`;
      } else if (verbosity < 2) {
        return `%c${p.name}%c: %c${typeToString(p.type)}`;
      } else if (verbosity < 3) {
        return `%c${p.name}%c = %c${valueToString(p.defaultValue)}`;
      } else {
        return `%c${p.name}%c = %c${valueToString(p.defaultValue)}%c: %c${typeToString(p.type)}`;
      }
    }).join("%c, ");

    const paramStyles = _.flatten(signature.parameters.map(p => {
      if (verbosity < 1) {
        return [paramName, punc];
      } else if (verbosity < 2) {
        return [paramName, punc, paramType, punc];
      } else if (verbosity < 3) {
        return [paramName, punc, paramDefault, punc];
      } else {
        return [paramName, punc, paramDefault, punc, paramType, punc];
      }
    })).slice(0, -1);

    const retType = typeToString(signature.returnType);

    return {
      str: `%c${signature.name}%c(${params}%c): %c${retType}`,
      formats: [fnName, punc, ...paramStyles, punc, `${returnType} ${lineBreak}`],
    }
  }
}


export class ConsoleUI {
  private readonly document: Document;

  constructor(document: Document, varName: string) {
    this.document = document;

    this.languageReference();
    Helper.setVarName(varName);
    Helper.printWelcome();
  }

  public help = () => {
    Helper.printHelp();
  }

  public languageReference = (verbosity: string = "vvv") => {
    Helper.printSignatures(this.document.environment, verbosity.length);
  }
}