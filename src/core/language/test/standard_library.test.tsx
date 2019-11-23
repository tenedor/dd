import {TestUtils} from '@test_utils/test_utils';

import {SimpleUpdateManager} from '@models/core/update_manager';
import {loadStandardLibrary} from '../standard_library';
import {buildLanguageTestHelpers} from "./test_helpers";

TestUtils.defaultBeforeAll();
const formulaEnvironment = loadStandardLibrary(new SimpleUpdateManager());

const {expectResults} = buildLanguageTestHelpers(formulaEnvironment);

describe('Standard Library', () => {

  describe('Sq', () => {
    expectResults('results', [
      {formula: "Sq()", result: 1},
      {formula: "Sq(Value = -3)", result: 9},
    ]);
  });

  describe('Power', () => {
    expectResults('results', [
      {formula: "Power()", result: 8},
      {formula: "Power(Base = -3, Exponent = 5)", result: -243},
      {formula: "Power(Base = 2, Exponent = -2)", result: 1 / 4},
    ]);
  });
});