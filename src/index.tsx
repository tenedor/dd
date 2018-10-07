import * as ReactDOM from 'react-dom';
import {App} from './app';
import './css/allthestyles.css';

const app = new App();

ReactDOM.render(
  app.renderApplication(),
  document.getElementById('root') as HTMLElement
);
