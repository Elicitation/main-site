import React from 'react';
import ReactDOM from 'react-dom';
import { Route, NavLink, Switch, BrowserRouter as Router } from 'react-router-dom'

import data from '../package.json';
import './index.css';

import Home from './components/Home/Home';
import Info from './components/Info/Info';
import Contact from './components/Contact/Contact';
import Error from './components/Error/Error';

import * as serviceWorker from './serviceWorker';

import { defineCustomElements } from 'Corporate-UI/dist/collection/helpers';

defineCustomElements(['c-header', 'c-navigation', 'c-content', 'c-footer', 'c-container', 'c-theme']);

const items = [
  { name: 'Home', url: '/', ctrl: Home, attrs: { exact: true } },
  { name: 'Info', url: '/info', ctrl: Info },
  { name: 'Contact', url: '/contact', ctrl: Contact }
]

const App = (
  <Router basename={data.name}>
    <c-theme name="scania"></c-theme>
    <c-header site-name="App">
      <NavLink to="/global" slot="items">global</NavLink>
      <c-navigation slot="navigation">
        {items.map((item, key) => <NavLink activeClassName="active" to={item.url} key={key} slot="primary-items" {...item.attrs} >{item.name}</NavLink> )}
      </c-navigation>
    </c-header>
    <c-content>
      <Switch>
        {items.map((item, key) => <Route path={item.url} component={item.ctrl} key={key} {...item.attrs} /> )}
        <Route component={Error} />
      </Switch>
    </c-content>
    <c-footer>
      <NavLink to="/contact" slot="items">Contact</NavLink>
    </c-footer>
  </Router>
)

ReactDOM.render(App, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
