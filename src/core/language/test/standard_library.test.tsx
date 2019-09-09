import {TestUtils} from '@test_utils/test_utils';

import {SimpleUpdateManager} from '@models/core/update_manager';
import {DrawingVariant} from '../drawing_value';
import {loadStandardLibrary} from '../standard_library';
import {ValueUtils} from '../values';
import {buildLanguageTestHelpers} from "./test_helpers";

TestUtils.defaultBeforeAll();
const formulaEnvironment = loadStandardLibrary(new SimpleUpdateManager());

const {expectResults} = buildLanguageTestHelpers(formulaEnvironment);

describe('Standard Library', () => {

  describe('Square', () => {
    expectResults('results', [
      {formula: "Square()", result: 1},
      {formula: "Square(Value = -3)", result: 9},
    ]);
  });

  describe('Power', () => {
    expectResults('results', [
      {formula: "Power()", result: 8},
      {formula: "Power(Base = -3, Exponent = 5)", result: -243},
      {formula: "Power(Base = 2, Exponent = -2)", result: 1 / 4},
    ]);
  });

  describe('DrawCircle', () => {
    const circleOf = ({radius = 10, fill = "black"}: {
      radius?: number, fill?: string,
    } = {}) => ValueUtils.drawingOf({
      drawingType: DrawingVariant.CIRCLE, radius, fill,
    });

    expectResults('results', [
      {formula: "DrawCircle()", result: circleOf()},
      {
        formula: "DrawCircle(Radius = 1, Fill = \"green\")",
        result: circleOf({radius: 1, fill: 'green'}),
      },
    ]);
  });

  describe('DrawEllipse', () => {
    const ellipseOf = ({radius1 = 15, radius2 = 10, fill = "black"}: {
      radius1?: number, radius2?: number, fill?: string,
    } = {}) => ValueUtils.drawingOf({
      drawingType: DrawingVariant.ELLIPSE, radius1, radius2, fill,
    });

    expectResults('results', [
      {formula: "DrawEllipse()", result: ellipseOf()},
      {
        formula: "DrawEllipse(Radius1 = 0, Radius2 = 1, Fill = \"green\")",
        result: ellipseOf({radius1: 0, radius2: 1, fill: 'green'}),
      },
    ]);
  });

  describe('DrawPath', () => {
    const pathOf = ({path = "m -15 9, c 10 -25, 20 -25, 30 0 z", fill = "black"}: {
      path?: string, fill?: string,
    } = {}) => ValueUtils.drawingOf({
      drawingType: DrawingVariant.PATH, path, fill,
    });

    const trianglePath = "m -10 0, l 10 10, l 10 -10 z";
    expectResults('results', [
      {formula: "DrawPath()", result: pathOf()},
      {
        formula: `DrawPath(Path = "${trianglePath}", X = 2, Y = 3, Fill = "green")`,
        result: pathOf({path: trianglePath, fill: 'green'}),
      },
    ]);
  });
});