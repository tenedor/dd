import * as ReactDOM from 'react-dom';

import '@css/allthestyles.css';
import {App} from './app';

const app = new App();

ReactDOM.render(
  app.renderApplication(),
  document.getElementById('root') as HTMLElement
);
