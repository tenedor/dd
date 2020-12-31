import * as ReactDOM from 'react-dom';

import {TestUtils} from '@test_utils/test_utils';
import {App} from '../app';

beforeAll(TestUtils.defaultBeforeAll);

it('renders', () => {
  const app = new App();
  app.init();
  const div = document.createElement('div');
  ReactDOM.render(app.renderApplication(), div);
  ReactDOM.unmountComponentAtNode(div);
});