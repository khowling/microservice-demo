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
                <use xlinkHref="#stroked-clipboard-with-paper"></use></svg><b>{this.props.title}</b>
            </div>
            <div className="panel-body1">
              <div className="row">
                <div className="col-xs-2">
                  <div></div>
                </div>
                { that.props.columns.filter((o) => o.key == "data.reqopen").length == 1 &&
                <div className="col-xs-6">
                    <b>busy</b>
                </div>
                }
                { that.props.columns && that.props.columns.map (({lb, key, len}) => (
                  <div className={`col-xs-${len}`}>
                    <b>{lb || key}</b>
                  </div>
                ))}
              </div>
              <ol className="list-items">
                  { renderList && renderList.length >0 && renderList.map ((k,i) => {
                      return <TableListItem key={i} item={k} columns={that.props.columns} checked={(this.state.selected.indexOf(k.id)>=0)} icon={that.props.icon}/>
                  })}
              </ol>
            </div>

            <div className="panel-footer">
            </div>
        </div>
        )
    }
}


const TableListItem = ({item, columns, icon}) => (
    <li className="list-items-row">
        <div className="row vertical-align" style={{"padding": "4px"}}>
            <div className="col-xs-2">
                <span className={`glyphicon glyphicon-${icon}`} aria-hidden="true" style={{"background-color": "#0078D7"}}></span>
            </div>
            { columns.filter((o) => o.key == "data.reqopen").length == 1 &&
            <div className="col-xs-6">
                <div className="progress">
                    <div className="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" style={{"width": `${item.data.reqopen*10}%`}}>
                        <span className="sr-only">60%</span>
                    </div>
                </div>
            </div>
            }
            { columns && columns.map (({key, len}) => { 
                let lu = key.split('.'),
                    calv = (lu.length == 1) ? item[lu[0]] :item[lu[0]][lu[1]]
                return (
                <div className={`col-xs-${len}`}>
                    {calv}
                </div>
            )})}
        </div>
    </li>
)
