//import './styles/lumino.css';
import 'winstrap/dist/css/winstrap.css'


import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import TableList from './components/tablelist.js'

import {store} from './lib/store'


export default class App extends Component {

  _wsSendJoin(keepalive) {
    this.ws.send(JSON.stringify({type: "JOIN", time: new Date().getTime(), name: this.input.value}));
  }

  _wsMessageEvent(event) {
    //console.log(`dispatching message from server ${event.data}`);
    var msg = JSON.parse(event.data)
    if (msg.type == 'JOINED' && msg.interval && !this.wsping) {
      this.wsping = setInterval (this._wsSendJoin.bind(this, true), msg.interval * 1000)
    }
    store.dispatch(msg)
  }

  _wsCloseEvent(event) {
    console.log ('close')
    clearInterval(this.wsping); this.wsping = null
    store.dispatch({type: 'LEFT'})
    this.ws.removeEventListener('open', this._wsSendJoin.bind(this));
    this.ws.removeEventListener('message', this._wsMessageEvent.bind(this));
    this.ws.removeEventListener('close', this._wsCloseEvent.bind(this));
    this.ws = null;
  }

  _toggleListen() {
    if (!this.ws) {
      this.ws = new WebSocket(`ws://${window.location.hostname}${DEV_PORT}/path`);
      this.ws.addEventListener('open', this._wsSendJoin.bind(this, false));
      this.ws.addEventListener('message', this._wsMessageEvent.bind(this));
      this.ws.addEventListener('close', this._wsCloseEvent.bind(this));
    } else {
      this.ws.close()
    }
  }

  componentDidMount() {
    this._toggleListen()
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
              Application Telemetry
            </h1>
          </header>
          <div className="row">
            <div className="col-xs-24 col-md-12">
              <div className="theme-dark color-fill-accent-vivid-high" style={{"padding": "1em"}}>
                <div className="form-group">
                    <label>Connection name</label>
                    <input type='text' className='form-control'  defaultValue={`${window.navigator.platform}-${window.navigator.product}`}
                ref={(input) => this.input = input}/>

                  <button className="btn btn-default theme-dark no-outline" onClick={this._toggleListen.bind(this)}>{!this.props.server_messages.server.name ? "Connect to stream" : `Disconnect from ${this.props.server_messages.server.name}`}</button>
                </div>
              </div>
            </div>
            <div className="col-xs-24 col-md-12">  
              <figure className="highlight" style={{"height": "400px"}}>
                <pre style={{"height": "90%", "overflow-y": "scroll", "margin": 0}} ref={(con) => { this.socketoutdom = con}}>
                  <code className="language-html" >
                      {this.props.server_messages.messages}
                  </code>
                </pre>
              </figure>
            </div>
          </div>
        </section>

        <div className="row">

          <div className="col-xs-24 col-md-24">  
            <TableList title="Process Role: FRONTEND" messages={this.props.server_messages.orderedSets} set_key="kapp_FRONTEND" icon="transfer" columns={[{key:"id",len:2},{lb:"hostname",key:"data.hostname",len:5}, {lb:"processing", key:"data.reqopen",len:2}, {lb:"complete",key:"data.reqcomp",len:2}, {lb: "uptime(sec)", key:"data.uptime",len:2}, {lb: "last req(S)",key:"data.lastreqtm",len:3}]}/>
          </div>
          <div className="col-xs-24 col-md-24">  
            <TableList title="Process Role: WORKER" messages={this.props.server_messages.orderedSets} set_key="kapp_WORKER" icon="cog" columns={[{key:"id",len:2},{lb:"hostname",key:"data.hostname",len:5}, {lb:"processing", key:"data.reqopen",len:2}, {lb:"complete",key:"data.reqcomp",len:2}, {lb: "uptime(sec)", key:"data.uptime",len:2}, {lb: "last req(S)",key:"data.lastreqtm",len:3}]}/>
          </div>
          { true && 
          <div className="col-xs-24 col-md-24">  
            <TableList title="Connected Telemtry Users" messages={this.props.server_messages.orderedSets} set_key="kapp_USERS" icon="user" columns={[{key:"id",len:2},{lb: "name", key:"data.name",len:4}, {lb: "server", key:"data.server",len:4}, {lb: "ping", key:"data.ping",len:2}, {lb: "time", key:"data.connected_for",len:2}, {lb: "platform", key:"data.platform",len:8}]}/>
          </div>
          }
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
  //console.log (`render path ${window.location.hash}`)
  if (window.location.hash == '#admin') {
    ReactDOM.render(<App {...store.getState()}/>, document.getElementById('root'));
  } else {
    ReactDOM.render(<Tickets user={{}}/>, document.getElementById('root'));
  }
}
store.subscribe(render)
render()
