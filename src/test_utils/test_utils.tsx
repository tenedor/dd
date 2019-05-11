import {Parser} from "@core/language/parser";
import {ohmGrammar} from './grammar';

export class TestUtils {
  public static defaultBeforeAll = () => {
    Parser.setGrammarForTests(ohmGrammar);
  }
}