import { createStore, combineReducers } from 'redux'
import update from 'immutability-helper';
/**
 * This is a reducer, a pure function with (state, action) => state signature.
 * It describes how an action transforms the state into the next state.
 *
 * The shape of the state is up to you: it can be a primitive, an array, an object,
 * or even an Immutable.js data structure. The only important part is that you should
 * not mutate the state object, but return a new object if the state changes.
 *
 * In this example, we use a `switch` statement and strings, but you can use a helper that
 * follows a different convention (such as function maps) if it makes sense for your
 * project.
 * 
 * AVOID ARRAY MUTATIONS with concat, slice and ...spread
 * AVOID OBJECT MUTATIONS with Object.assign and ...spread
 */
function server_messages(state =  { orderedSets: {}, server: {}, messages: '> ' }, action) {
  //console.log (`store: reducer called with ${JSON.stringify(action)}`)
  let ret = {}
  switch (action.type) {
    case 'LEFT': 
      ret =  { orderedSets: {}, server: {}}
      break
    case 'JOINED':
      //   http://redux.js.org/docs/recipes/UsingObjectSpreadOperator.html
      ret =  {server: {name: action.name, server: action.server}}
      break
    case 'UPDATEKEY':
      if (!state.orderedSets[action.key]) { 
        ret =  {orderedSets: { ...state.orderedSets,  [action.key]: [action]}}
      } else {
        let updt_idx = state.orderedSets[action.key].findIndex((e) => e.id === action.id);
        if (updt_idx >=0) {
          // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
          ret = {orderedSets: update (state.orderedSets, {[action.key]: {$splice:[[updt_idx, 1, action]]}})}
        } else {
          ret = {orderedSets: update (state.orderedSets, {[action.key]: {$push:[action]}})}
        }
      }
      break
    case 'REMOVEKEY':
      if (state.orderedSets[action.key]) { 
        let rm_idx = state.orderedSets[action.key] && state.orderedSets[action.key].findIndex((e) => e.id === action.id);
        if (rm_idx >=0) {// perform 1 splice, at position existing_idx, remove 1 element
          ret =  {orderedSets: update (state.orderedSets, {[action.key]: {$splice: [[rm_idx, 1]]}})}
        }
      }
      break
    default:
      console.log (`unknown mesg ${action.key}`)
  }
  // update(this.state.alldatafromserver, {$push: [server_data]})}
  return { ...state,  ...ret, messages: state.messages + JSON.stringify(action) + '\n> '}
}


/* each key in the object is a referene to a field in the 'state' object,
 * and the value is the reducer function that will manage that part of the state
 * 
 * NOTE: the object uses the ES6 'object literal shorthand notation', since the key and value names are the same
 */
const myApp = combineReducers({
    server_messages
})

// Create a Redux store holding the state of your app.
// Its API is { subscribe, dispatch, getState }.
export let store = createStore(myApp)
