//import './styles/lumino.css';
import 'winstrap/dist/css/winstrap.css'


import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import TableList from './components/tablelist.js'

import {store} from './lib/store'


export default class App extends Component {

  _wsOpenEven(event) {
    console.log ('open')
    let sendjoin = () => {
      this.ws.send(JSON.stringify({type: "JOIN", time: new Date().getTime(), name: this.input.value}));
    }
    this.wsping = setInterval (sendjoin, 10 * 1000)
    sendjoin()
  }

  _wsMessageEvent(event) {
    console.log(`dispatching message from server ${event.data}`);
    store.dispatch(JSON.parse(event.data))
  }

  _wsCloseEvent(event) {
    console.log ('close')
    clearInterval(this.wsping)
    store.dispatch({type: 'LEFT'})
    this.ws.removeEventListener('open', this._wsOpenEven.bind(this));
    this.ws.removeEventListener('message', this._wsMessageEvent.bind(this));
    this.ws.removeEventListener('close', this._wsCloseEvent.bind(this));
    this.ws = null;
  }

  _toggleListen() {
    if (!this.ws) {
      this.ws = new WebSocket('ws://localhost:9090/path');
      this.ws.addEventListener('open', this._wsOpenEven.bind(this));
      this.ws.addEventListener('message', this._wsMessageEvent.bind(this));
      this.ws.addEventListener('close', this._wsCloseEvent.bind(this));
    } else {
      this.ws.close()
    }
  }

  componentDidUpdate() {
    this.socketoutdom.scrollTop = this.socketoutdom.scrollHeight
  }

  render() {
    return (
      <div className="container">
        <section className="section">
          <header className="section-header row">
            <h1 className="section-title col-xs-24">
              Assets
            </h1>
          </header>
          <div className="row">
            <div className="col-xs-12">
              <div className="theme-dark color-fill-accent-vivid-high" style={{"padding": "1em"}}>
                <div className="form-group">
                    <label>My Name</label>
                    <input type='text' className='form-control'  defaultValue={`${window.navigator.platform}-${window.navigator.product}`}
                ref={(input) => this.input = input}/>

                  <button className="btn btn-default theme-dark no-outline" onClick={this._toggleListen.bind(this)}>Connect</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="row">
          <div className="col-xs-24 col-md-12">  
            <figure className="highlight" style={{"height": "400px"}}>
              <pre style={{"height": "90%", "overflow-y": "scroll"}} ref={(con) => { this.socketoutdom = con}}>
                <code className="language-html" >
                    {this.props.server_messages.messages}
                </code>
              </pre>
            </figure>

          </div>
          <div className="col-xs-24 col-md-12">  
            <TableList title="Server Messages" messages={this.props.server_messages.orderedSets} set_key="kapp_node" columns={[{key:"id",len:4},{key:"data.hostname",len:8}, {key:"data.uptime",len:4}, {key:"data.users",len:2}]}/>
          </div>
          <div className="col-xs-24 col-md-12">  
            <TableList title="Server Messages" messages={this.props.server_messages.orderedSets} set_key="kapp_user" columns={[{key:"id",len:2},{lb: "name", key:"data.name",len:8}, {lb: "ping", key:"data.ping",len:2}, {lb: "time", key:"data.connected_for",len:2}, {lb: "platform", key:"data.platform",len:8}]}/>
          </div>
        </div>
      </div>
    );
  }
}

import Landing  from './components/landing'
import NavBar  from './components/navbar'
const Tickets = ({user}) => (
  <div>
    <NavBar user={user}/>
    <Landing/>
  </div>
)


const render = () => {
  //console.log (`---rerender new props ${store.getState().server_messages.messages.length}`)
  console.log (`render path ${window.location.hash}`)
  if (window.location.hash == '#admin') {
    ReactDOM.render(<App {...store.getState()}/>, document.getElementById('root'));
  } else {
    ReactDOM.render(<Tickets user={{}}/>, document.getElementById('root'));
  }
}
store.subscribe(render)
render()
