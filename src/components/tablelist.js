import React, {Component} from 'react'

export default class TableList extends Component {

	constructor (props) {
		super(props);
		this.state = {reference_txt: "", selected: []}
	}
    _selectfn(id) {
		
	}
    _handleChange (e) {
      this.setState({reference_txt: e.target.value})
    }
    _buttonPress() {
		//this.props.buttonfn(this.state.selected, this.state.oref)
		this.setState({selected: [], reference_txt: ""})
	}


    render() {
        let that = this, renderList = this.props.set_key ? this.props.messages[this.props.set_key] : this.props.messages
        return(
        <div className="panel panel-blue">
            <div className="panel-heading dark-overlay"><svg className="glyph stroked clipboard-with-paper">
                <use xlinkHref="#stroked-clipboard-with-paper"></use></svg>{this.props.title}
            </div>
            <div className="panel-body">
              <div className="row">
                <div className="col-md-1">
                  <input type="checkbox" id="checkbox" />
                </div>
                { that.props.columns && that.props.columns.map (({lb, key, len}) => (
                  <div className={`col-md-${len}`}>
                    <b>{lb || key}</b>
                  </div>
                ))}
              </div>
              <ol className="list-items">
                  { renderList && renderList.length >0 && renderList.map ((k,i) => {
                      return <TableListItem key={i} item={k} columns={that.props.columns} checked={(this.state.selected.indexOf(k.id)>=0)} selectfn={this._selectfn.bind(this)}/>
                  })}
              </ol>
            </div>

            <div className="panel-footer">

                <div className="input-group">
                    <input id="btn-input" type="text" className="form-control input-md" placeholder="run reference" onChange={this._handleChange.bind(this)} value={this.state.reference_txt}/>
                    <span className="input-group-btn">
                            <button className="btn btn-primary btn-md" disabled={(this.state.selected.length == 0)} id="btn-todo" onClick={this._buttonPress.bind(this)} >Send</button>
                    </span>
                </div>

            </div>
        </div>
        )
    }
}


const TableListItem = ({item, columns, selectfn, checked}) => (
    <li className="list-items-row">
      <div className="row" style={{"padding": "4px"}}>
          <div className="col-md-1">
            <input type="checkbox" id="checkbox" defaultChecked={checked} onClick={selectfn.bind(this, item.id, checked)}/>
          </div>
          { columns && columns.map (({key, len}) => { 
            let lu = key.split('.'),
                calv = (lu.length == 1) ? item[lu[0]] :item[lu[0]][lu[1]]
            return (
            <div className={`col-md-${len}`}>
              {calv}
            </div>
          )})}
        
      </div>
    </li>
)
