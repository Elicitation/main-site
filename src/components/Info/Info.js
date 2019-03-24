import React, { Component } from 'react';
import { Route, NavLink, Switch, Redirect } from 'react-router-dom';

import './info.css';

const List = () => (
  <ul>
    <li>First</li>
    <li>Second</li>
    <li>Third</li>
  </ul>
)
const Table = () => (
  <table>
    <thead>
      <tr>
        <th>id</th><th>name</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>1</th><th>andreas</th>
      </tr>
      <tr>
        <th>2</th><th>jesper</th>
      </tr>
    </tbody>
  </table>
)
const Form = () => (
  <form>
    <fieldset>
      <legend>Name</legend>
      <label>First</label>
      <input type="text" name="fname" />
      <label>Last</label>
      <input type="text" name="lname" />
    </fieldset>
  </form>
)

const items = [
  { name: 'Tab 1', url: 'list', ctrl: List },
  { name: 'Tab 2', url: 'table', ctrl: Table },
  { name: 'Tab 3', url: 'form', ctrl: Form }
]

class Info extends Component {
  render() {
    return (
      <section>
        <c-container type="fluid">
          <h1>Info</h1>
          <div className="tabs">
            <nav className="tab-header">
              {items.map((item, key) => <NavLink activeClassName="active" to={'/info/' + item.url} key={key}>{item.name}</NavLink> )}
            </nav>
            <div className="tab-body">
              <Switch>
                {items.map((item, key) => <Route path={'/info/' + item.url} component={item.ctrl} key={key} /> )}
                <Redirect from="/info" to="/info/list" />
              </Switch>
            </div>
          </div>
        </c-container>
      </section>
    );
  }
}

export default Info;
