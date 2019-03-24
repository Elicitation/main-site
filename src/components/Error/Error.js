import React, { Component } from 'react';

class Error extends Component {
  render() {
    return (
      <section>
        <c-container type="fluid">
          <h1>Not found</h1>
          <p>The link you tried to reach does not exist.</p>
        </c-container>
      </section>
    );
  }
}

export default Error;
