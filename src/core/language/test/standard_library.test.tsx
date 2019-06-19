import {ConvertibleToValue} from '@test_utils/test_utils';
import {DrawingVariant} from '../drawing_value';
import {FormulaEnvironment} from '../formula_environment';
import {ValueUtils} from '../values';
import {expectResults as _expectResults} from "./language.test";

const formulaEnvironment = new FormulaEnvironment();

export const expectResults = (
  name: string,
  formulas: Array<{formula: string, result: ConvertibleToValue}>,
) => {
  _expectResults(name, formulas, formulaEnvironment.nameResolver);
}

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
    const circleOf = ({radius = 10, x = 0, y = 0, fill = "black"}: {
      radius?: number, x?: number, y?: number, fill?: string,
    } = {}) => ValueUtils.drawingOf({
      drawingType: DrawingVariant.CIRCLE, radius, center: {x, y}, fill,
    });

    expectResults('results', [
      {formula: "DrawCircle()", result: circleOf()},
      {
        formula: "DrawCircle(Radius = 1, X = 2, Y = 3, Fill = \"green\")",
        result: circleOf({radius: 1, x: 2, y: 3, fill: 'green'}),
      },
    ]);
  });

  describe('DrawEllipse', () => {
    const ellipseOf = ({radius1 = 15, radius2 = 10, x = 0, y = 0, fill = "black"}: {
      radius1?: number, radius2?: number, x?: number, y?: number, fill?: string,
    } = {}) => ValueUtils.drawingOf({
      drawingType: DrawingVariant.ELLIPSE, radius1, radius2, center: {x, y}, fill,
    });

    expectResults('results', [
      {formula: "DrawEllipse()", result: ellipseOf()},
      {
        formula: "DrawEllipse(Radius1 = 0, Radius2 = 1, X = 2, Y = 3, Fill = \"green\")",
        result: ellipseOf({radius1: 0, radius2: 1, x: 2, y: 3, fill: 'green'}),
      },
    ]);
  });

  describe('DrawPath', () => {
    const pathOf = ({path = "m -15 9, c 10 -25, 20 -25, 30 0 z", x = 0, y = 0, fill = "black"}: {
      path?: string, x?: number, y?: number, fill?: string,
    } = {}) => ValueUtils.drawingOf({
      drawingType: DrawingVariant.PATH, path, center: {x, y}, fill,
    });

    const trianglePath = "m -10 0, l 10 10, l 10 -10 z";
    expectResults('results', [
      {formula: "DrawPath()", result: pathOf()},
      {
        formula: `DrawPath(Path = "${trianglePath}", X = 2, Y = 3, Fill = "green")`,
        result: pathOf({path: trianglePath, x: 2, y: 3, fill: 'green'}),
      },
    ]);
  });
});