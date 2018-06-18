const async = require('async');
const path = require('path');
const configData = require('../data/config.js');
const homedir = require('homedir');
const jsonfile = require('jsonfile');
const _ = require('underscore');
const appUtils = require('./AppUtils');


const RUNNING = 'RUNNING';
const NO_NETWORK = 'NO_NETWORK';
const STOPPED = 'STOPPED';

function getStateFile(callback) {
  configData.getConfig((err, config) => {
    if (err) callback(err);
    else {
      const lsf = path.join(homedir(), config.mainDir, 'lab_states.json');
      callback(null, lsf);
    }
  });
}

function getStateFileSync() {
  const config = appUtils.getConfigSync();
  const lsf = path.join(homedir(), config.mainDir, 'lab_states.json');
  return lsf;
}

function getStatesSync() {
  const lsf = getStateFileSync();
  return jsonfile.readFileSync(lsf);
}


function getStates(callback) {
  async.waterfall([
    (cb) => getStateFile(cb),
    (lsf, cb) => {
      jsonfile.readFile(lsf, cb);
    }], (err, jsonArray) => callback(err, jsonArray));
}

function _getRepoStates(repoName, arrayStates) {
  return _.filter(arrayStates, { repoName });
}

function _getState(repoName, labName, arrayStates) {
  return _.findWhere(arrayStates, { repoName, labName });
}

function _getStateIndex(repoName, labName, arrayStates) {
  return _.findIndex(arrayStates, { repoName, labName });
}

function getState(repoName, labName, callback) {
  async.waterfall([
    cb => getStates(cb),
    (arrayStates, cb) => {
      const ret = _getState(repoName, labName, arrayStates);
      if (ret) cb(null, ret.state);
      else cb(null, null);
    }],
    (err, response) => callback(err, response));
}
function getStateSync(repoName, labName) {
  const arrayStates = getStatesSync();
  const ret = _getState(repoName, labName, arrayStates);
  if (ret) return ret.state;
  else return null;
}

function existsSync(repoName, labName) {
  const s = getStateSync(repoName, labName);
  if (s) return true;
  else return false;
}

function exists(repoName, labName, callback) {
  getState(repoName, labName, (err, state) => {
    if (err) callback(err);
    else if (state) callback(null, true);
    else callback(null, false);
  });
}
function getRepoStates(repoName, callback) {
  getStates((err, states) => {
    if (err) callback(err);
    else {
      const sRepos = _getRepoStates(repoName, states);
      callback(null, sRepos);
    }
  });
}
// Returns the list of labs state not equal to the input state
function checkAll(repoName, state, callback) {
  let allEqual = true;
  const labsWrong = [];
  async.waterfall([
    (cb) => getStates(cb),
    (jsonArray, cb) => {
      // console.log('in search');
      const sRepos = _getRepoStates(repoName, jsonArray);
      _.each(sRepos, (e) => {
        if (e.state !== state) {
          allEqual = false;
          labsWrong.push(e);
        }
      });
      cb(null);
    }], (err) => callback(err, allEqual, labsWrong));
}
// Returns true if some repo is in state
function checkSome(repoName, state, callback) {
  console.log('IN CHECKSOME');
  console.log(repoName);
  console.log(state);
  console.log(callback);
  let someInState = false;
  const labsWrong = [];
  async.waterfall([
    (cb) => getStates(cb),
    (jsonArray, cb) => {
      // console.log('in search');
      const sRepos = _getRepoStates(repoName, jsonArray);
      _.each(sRepos, (e) => {
        if (e.state === state) {
          someInState = true;
          labsWrong.push(e);
        }
      });
      cb(null);
    }], (err) => callback(err, someInState, labsWrong));
}

function editState(repoName, labName, objState, callback) {
  async.waterfall([
    (cb) => getStates(cb),
    (jsonArray, cb) => {
      const index = _getStateIndex(repoName, labName, jsonArray);
      if (index === -1) cb(new Error('State no found'));
      else {
        jsonArray[index].repoName = objState.repoName || jsonArray[index].repoName;
        jsonArray[index].labName = objState.labName || jsonArray[index].labName;
        jsonArray[index].state = objState.state || jsonArray[index].state;
        getStateFile((err, jsf) => {
          if (err) cb(err);
          else jsonfile.writeFile(jsf, jsonArray, cb);
        });
      }
    }], (err) => callback(err));
}

function editStates(repoName, objState, callback) {
  let newStates;
  async.waterfall([
    (cb) => getStates(cb),
    (states, cb) => {
      newStates = states;
      _.each(newStates, (ns) => {
        if (ns.repoName === repoName)
        {
          ns.repoName = objState.repoName || ns.repoName;
          ns.state = objState.state || ns.state;
        }
      });
      cb(null);
    },
    (cb) => getStateFile(cb),
    (lsf, cb) => jsonfile.writeFile(lsf, newStates, cb)
  ],
   (err) => callback(err));
}

function setState(repoName, labName, state, callback) {
  editState(repoName, labName, { state }, callback);
}

function setRunningState(repoName, nameLab, callback) {
  setState(repoName, nameLab, RUNNING, callback);
}

function setNoNetworkState(repoName, nameLab, callback) {
  setState(repoName, nameLab, NO_NETWORK, callback);
}
function setStopState(repoName, nameLab, callback) {
  setState(repoName, nameLab, STOPPED, callback);
}

function newStateSync(repoName, labName, state) {
  const jsonArray = getStatesSync();
  const index = _getStateIndex(repoName, labName, jsonArray);
  if (index !== -1) throw new Error('State already exists!');
  else {
    jsonArray.push({
      repoName,
      labName,
      state
    });
    const jsf = getStateFileSync();
    jsonfile.writeFileSync(jsf, jsonArray);
  }
}

function newState(repoName, labName, state, callback) {
  const log = appUtils.getLogger();
  log.info('[NEW STATE]');
  log.info(`Creating ${repoName} / ${labName}`);

  async.waterfall([
    (cb) => getStates(cb),
    (jsonArray, cb) => {
      const index = _getStateIndex(repoName, labName, jsonArray);
      if (index !== -1) cb(new Error('State already exists!'));
      else {
        jsonArray.push({
          repoName,
          labName,
          state
        });
        getStateFile((err, jsf) => {
          if (err) cb(err);
          else jsonfile.writeFile(jsf, jsonArray, cb);
        });
      }
    }], (err) => callback(err));
}

function removeState(repoName, labName, callback) {
  const log = appUtils.getLogger();
  log.info('[REMOVE STATE]');
  log.info(`Deleting ${repoName} / ${labName}`);
  async.waterfall([
    (cb) => getStates(cb),
    (jsonArray, cb) => {
      const index = _getStateIndex(repoName, labName, jsonArray);
      if (index === -1) cb(new Error('State no found'));
      else {
        jsonArray.splice(index, 1);
        getStateFile((err, jsf) => {
          if (err) cb(err);
          else jsonfile.writeFile(jsf, jsonArray, cb);
        });
      }
    }], (err) => callback(err));
}

function removeStates(repoName, callback) {
  async.waterfall([
    (cb) => getStates(cb),
    (jsonArray, cb) => {
      const sRepos = _getRepoStates(repoName, jsonArray);
      async.eachSeries(sRepos, (s, c) => {
        removeState(s.repoName, s.labName, c);
      }, (err) => {
        cb(err);
      });
    }], (err) => callback(err));
}

function initStates(repoName, callback) {
  const log = appUtils.getLogger();
  const dirs = appUtils.getDSPDirsSync(repoName);
  // Delete all states
  removeStates(repoName, (err) => {
    if (err) callback(err);
    else {
      // Initialize all states
      async.eachSeries(dirs, (labName, c) => {
        log.info(`[LAB_STATES INIT] Insert STOPPED state of ${labName} in lab_states.json`);
        newState(repoName, labName, 'STOPPED', c);
      }, (errInit) => callback(errInit));
    }
  });
}

module.exports = {
  setRunningState,
  setNoNetworkState,
  setStopState,
  getState,
  getStates,
  getRepoStates,
  getStateSync,
  getStatesSync,
  exists,
  existsSync,
  editState,
  editStates,
  newState,
  newStateSync,
  removeState,
  removeStates,
  initStates,
  checkSome,
  checkAll
};