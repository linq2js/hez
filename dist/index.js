"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.withActions = exports.withState = exports.useStoreMemo = exports.useStore = exports.useActions = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.createState = createState;
exports.createStore = createStore;
exports.compose = compose;
exports.hoc = hoc;
exports.Provider = Provider;
exports.createActionGroup = createActionGroup;

var _react = require("react");

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

if (!_react.useMemo) {
  throw new Error("This package requires React hooks. Please install React 16.7+");
}

var defaultSelector = function defaultSelector(state) {
  return state;
};
var storeContext = (0, _react.createContext)(null);
var isStoreProp = "@@store";
var isActionGroupProp = "@@actionGroup";
var acceptedActionsProp = "@@acceptedActions";
var defaultInjectedProps = {};
var defaultState = {};
var noop = function noop() {};
var uniqueId = Math.floor(new Date().getTime() * Math.random());

/**
 * create state manager
 */
function createState() {
  var initialStateOrAccessor = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultState;
  var onChange = arguments[1];
  var injectedProps = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : defaultInjectedProps;
  var addActionListener = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : noop;

  var localState = typeof initialStateOrAccessor === "function" ? {} : initialStateOrAccessor;
  var stateAccessor = typeof initialStateOrAccessor === "function" ? initialStateOrAccessor : function () {
    return localState;
  };
  var api = {
    getState: getState,
    setState: setState,
    mergeState: mergeState,
    addActionListener: addActionListener,
    reduceState: reduceState
  };

  var shorthandApi = {
    get: getState,
    set: setState,
    merge: mergeState,
    on: addActionListener,
    reduce: reduceState
  };

  function getState(prop) {
    return arguments.length ? typeof prop === "function" ? prop(stateAccessor()) : stateAccessor()[prop] : stateAccessor();
  }

  function setState() {
    var state = stateAccessor();

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length === 2) {
      // support state prop modifier
      // state.set('count', x => x + 1)
      var prop = args[0],
          modifier = args[1];

      var prevValue = state[prop];
      var nextValue = modifier(prevValue);
      if (nextValue !== prevValue) {
        // clone current state
        var nextState = Array.isArray(state) ? state.slice() : Object.assign({}, state);
        nextState[prop] = nextValue;
        notify(nextState);
      }
    } else {
      var _nextState = args[0];
      // support callback
      // state.set(state => doSomething)

      if (typeof _nextState === "function") {
        _nextState = _nextState(state);
      }
      if (state === _nextState) {
        return;
      }
      notify(_nextState);
    }
  }

  function notify(state) {
    onChange && onChange(state);
    localState = state;
  }

  function mergeState(nextState) {
    var state = stateAccessor();
    if (typeof nextState === "function") {
      return mergeState(nextState(state));
    }
    var hasChange = false;
    // loop through all nextState props, detect any change
    Object.keys(nextState).some(function (key) {
      if (nextState[key] !== state[key]) {
        hasChange = true;
        return true;
      }
      return false;
    });
    if (!hasChange) return;
    setState(Object.assign({}, state, nextState));
  }

  function reduceState() {
    for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    var reducers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var state = stateAccessor();
    var nextState = state;
    Object.keys(reducers).forEach(function (key) {
      var reducer = reducers[key];
      var value = state[key];
      var nextValue = reducer.apply(undefined, [value].concat(args));
      if (nextValue !== value) {
        if (state === nextState) {
          nextState = Object.assign({}, state);
        }
        nextState[key] = nextValue;
      }
    });

    setState(nextState);

    return nextState;
  }

  return new Proxy({}, {
    get: function get(target, prop) {
      if (prop in shorthandApi) {
        return shorthandApi[prop];
      }
      if (prop in injectedProps) {
        var value = injectedProps[prop];
        // create wrapper for injected method
        if (typeof value === "function") {
          return function () {
            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
              args[_key3] = arguments[_key3];
            }

            return value.apply(undefined, [api].concat(args));
          };
        }
        return value;
      }
      return getState(prop);
    }
  });
}

/**
 * create store
 */
function createStore() {
  var initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var subscribers = [];
  var stateProps = {};
  var middlewares = [];
  var actionSubscriptions = {};
  var store = _defineProperty({
    getState: getState,
    dispatch: dispatch,
    subscribe: subscribe,
    inject: inject,
    use: use
  }, isStoreProp, true);
  var hasActionSubscription = void 0;
  var state = initialState;
  var lastDispatchedAction = void 0;
  var shouldNotify = false;
  var dispatchingScopes = 0;

  function subscribe(subscriber) {
    var unsubscribed = false;
    subscribers.push(subscriber);
    // return unsubscribe
    return function () {
      if (unsubscribed) return;
      unsubscribed = true;
      var index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  function addActionListener(action, handler) {
    var name = action.displayName || action.name || String(action);
    if (!(name in actionSubscriptions)) {
      actionSubscriptions[name] = [];
      actionSubscriptions[name].map = new WeakMap();
    }

    var list = actionSubscriptions[name];
    var unsubscribe = list.map.get(handler);
    if (unsubscribe) return unsubscribe;

    list.push(handler);
    hasActionSubscription = true;

    list.map.set(handler, unsubscribe = function unsubscribe() {
      var index = list.indexOf(handler);
      if (index !== -1) {
        list.splice(index, 1);
      }
    });

    return unsubscribe;
  }

  function notifyActionDispatch(action, state, result) {
    if (!hasActionSubscription) return;
    var name = action.displayName || action.name || String(action);
    var list = actionSubscriptions[name];
    list && list.forEach(function (subscriber) {
      return subscriber(state, result);
    });
  }

  function getState() {
    return state;
  }

  function createStateForAction(action) {
    return createState(getState, function (nextState) {
      state = nextState;
      notify(action.displayName || action.name);
    }, stateProps, addActionListener);
  }

  function use(middleware) {
    middlewares.push(middleware);
  }

  function dispatch(action) {
    for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
      args[_key4 - 1] = arguments[_key4];
    }

    return middlewares.reduce(function (next, middleware) {
      return function (action) {
        for (var _len5 = arguments.length, args = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
          args[_key5 - 1] = arguments[_key5];
        }

        return middleware(next).apply(undefined, [action].concat(args));
      };
    }, internalDispatch).apply(undefined, [action].concat(args));
  }

  function internalDispatch(action) {
    dispatchingScopes++;
    try {
      var actions = Array.isArray(action) ? action : [action];
      var lastResult = void 0;

      for (var _len6 = arguments.length, args = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
        args[_key6 - 1] = arguments[_key6];
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = actions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _action = _step.value;

          var _state = createStateForAction(_action);
          lastResult = _action.apply(undefined, [_state].concat(args));
          notifyActionDispatch(_action, _state, lastResult);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return lastResult;
    } finally {
      dispatchingScopes--;
      if (!dispatchingScopes && shouldNotify) {
        shouldNotify = false;
        notify(lastDispatchedAction);
      }
    }
  }

  function notify(action) {
    if (dispatchingScopes) {
      shouldNotify = true;
      lastDispatchedAction = action;
      return;
    }
    subscribers.forEach(function (subscriber) {
      return subscriber(getState(), { action: action });
    });
  }

  /**
   * inject state props
   */
  function inject(props) {
    Object.assign(stateProps, props);
  }

  return store;
}

/**
 * useActions(store, ...actions)
 * useActions(...actions)
 */
var useActions = exports.useActions = createStoreUtility(function (store) {
  for (var _len7 = arguments.length, actions = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
    actions[_key7 - 1] = arguments[_key7];
  }

  return (0, _react.useMemo)(function () {
    if (actions[0][isActionGroupProp]) {
      var actionGroup = actions[0];
      return actions.slice(1).map(function (actionType) {
        return actionGroup[actionType];
      });
    }
    return actions.map(function (action) {
      return function () {
        for (var _len8 = arguments.length, args = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
          args[_key8] = arguments[_key8];
        }

        return store.dispatch.apply(store, [action].concat(args));
      };
    });
  }, [store].concat(actions));
});

/**
 * useStore(store, selector, ...cacheKeys)
 * useStore(selector, ...cacheKeys)
 */
var useStore = exports.useStore = createStoreUtility(function (store) {
  for (var _len9 = arguments.length, cacheKeys = Array(_len9 > 2 ? _len9 - 2 : 0), _key9 = 2; _key9 < _len9; _key9++) {
    cacheKeys[_key9 - 2] = arguments[_key9];
  }

  var selector = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultSelector;

  var state = store.getState();
  var globalState = (0, _react.useMemo)(function () {
    return selector(state);
  }, [state]);

  var _useState = (0, _react.useState)(globalState),
      _useState2 = _slicedToArray(_useState, 2),
      localState = _useState2[0],
      setLocalState = _useState2[1];

  (0, _react.useEffect)(function () {
    return store.subscribe(function (nextState) {
      var nextLocalState = selector(nextState);
      if (nextLocalState !== localState) {
        setLocalState(localState = nextLocalState);
      }
    });
  }, cacheKeys);
  return localState;
});

/**
 * useStoreMemo(store, cacheKeysSelector, stateSelector, ...extraCacheKeys)
 * useStoreMemo(cacheKeysSelector, stateSelector, ...extraCacheKeys)
 */
var useStoreMemo = exports.useStoreMemo = createStoreUtility(function (store, cacheKeysSelector) {
  for (var _len10 = arguments.length, extraCacheKeys = Array(_len10 > 3 ? _len10 - 3 : 0), _key10 = 3; _key10 < _len10; _key10++) {
    extraCacheKeys[_key10 - 3] = arguments[_key10];
  }

  var stateSelector = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function (state) {
    return state;
  };

  if (Array.isArray(cacheKeysSelector)) {
    var selectors = cacheKeysSelector;
    cacheKeysSelector = function cacheKeysSelector() {
      for (var _len11 = arguments.length, args = Array(_len11), _key11 = 0; _key11 < _len11; _key11++) {
        args[_key11] = arguments[_key11];
      }

      return selectors.map(function (selector) {
        return selector.apply(undefined, args);
      });
    };
  }
  var cacheKeys = useStore(store, cacheKeysSelector).concat(extraCacheKeys);
  return (0, _react.useMemo)(function () {
    return stateSelector.apply(undefined, _toConsumableArray(cacheKeys));
  }, cacheKeys);
});

/**
 * withState(store, selector, cacheKeyFactory)
 * withState(selector, cacheKeyFactory)
 */
var withState = exports.withState = createStoreHoc(function (Component, props, initialData, store, selector, cacheKeyFactory) {
  var nextProps = useStore.apply(undefined, [store, function (state) {
    return selector(state, props);
  }].concat(_toConsumableArray(cacheKeyFactory && cacheKeyFactory(props) || [])));

  return (0, _react.createElement)(Component, nextProps);
});

/**
 * withActions(store, actions)
 * withActions(actions)
 */
var withActions = exports.withActions = createStoreHoc(function (Component, props, _ref, store) {
  var keys = _ref.keys,
      values = _ref.values;

  var nextProps = {};
  var mappedActions = useActions.apply(undefined, [store].concat(_toConsumableArray(values)));
  mappedActions.forEach(function (mappedAction, index) {
    return nextProps[keys[index]] = mappedAction;
  });
  return (0, _react.createElement)(Component, Object.assign(nextProps, props));
}, function (actions) {
  return {
    keys: Object.keys(actions),
    values: Object.values(actions)
  };
});

function compose() {
  for (var _len12 = arguments.length, functions = Array(_len12), _key12 = 0; _key12 < _len12; _key12++) {
    functions[_key12] = arguments[_key12];
  }

  if (functions.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (functions.length === 1) {
    return functions[0];
  }

  return functions.reduce(function (a, b) {
    return function () {
      return a(b.apply(undefined, arguments));
    };
  });
}

function hoc() {
  for (var _len13 = arguments.length, callbacks = Array(_len13), _key13 = 0; _key13 < _len13; _key13++) {
    callbacks[_key13] = arguments[_key13];
  }

  return callbacks.reduce(function (nextHoc, callback) {
    return function (Component) {
      var MemoComponent = (0, _react.memo)(Component);

      return function (props) {
        if (callback.length > 1) {
          return callback(props, MemoComponent);
        }
        var newProps = callback(props);
        if (newProps === false) return null;
        if (!newProps) {
          newProps = props;
        }

        return (0, _react.createElement)(MemoComponent, newProps);
      };
    };
  }, function (Component) {
    return Component;
  });
}

function Provider(_ref2) {
  var store = _ref2.store,
      children = _ref2.children;

  return (0, _react.createElement)(storeContext.Provider, { value: store, children: children });
}

/***
 * createActionGroup(accept, reducer)
 * createActionGroup(reducer)
 * createActionGroup(name, accept, reducer)
 * createActionGroup(name, reducer)
 * @param args
 * @return {*}
 */
function createActionGroup() {
  var name = void 0,
      reducer = void 0,
      accept = void 0;
  if (arguments.length > 1) {
    // createActionGroup(name, accept, reducer)
    if (Array.isArray(arguments.length <= 1 ? undefined : arguments[1])) {
      name = arguments.length <= 0 ? undefined : arguments[0];
      accept = arguments.length <= 1 ? undefined : arguments[1];
      reducer = arguments.length <= 2 ? undefined : arguments[2];
    } else {
      // createActionGroup(accept, reducer)
      if (Array.isArray(arguments.length <= 0 ? undefined : arguments[0])) {
        name = "@@reducer_" + generateId();
        accept = arguments.length <= 0 ? undefined : arguments[0];
        reducer = arguments.length <= 1 ? undefined : arguments[1];
      } else {
        // createActionGroup(name, reducer)
        accept = [];
        name = arguments.length <= 0 ? undefined : arguments[0];
        reducer = arguments.length <= 1 ? undefined : arguments[1];
      }
    }
  } else {
    // createActionGroup(reducer)
    name = "@@reducer_" + generateId();
    reducer = arguments.length <= 0 ? undefined : arguments[0];
    accept = [];
  }

  var actionCache = {};

  return new Proxy({}, {
    get: function get(target, prop) {
      if (prop === isActionGroupProp) return true;
      if (prop in actionCache) {
        return actionCache[prop];
      }

      if (accept.length && !accept.includes(prop)) {
        throw new Error("No action " + prop + " is defined in this action group");
      }

      return actionCache[prop] = createAction(name, reducer, prop);
    }
  });
}

function createAction(name, reducer, prop) {
  var action = typeof reducer === "function" ? function (state, payload) {
    var prev = state.get();
    var next = reducer(prev, { type: prop, payload: payload });
    if (next !== prev) {
      state.set(next);
    }
  } : function (state, payload) {
    return state.reduce(reducer, { type: prop, payload: payload });
  };
  action.displayName = name + "." + prop;
  return action;
}

function createStoreUtility(callback) {
  return function () {
    for (var _len14 = arguments.length, args = Array(_len14), _key14 = 0; _key14 < _len14; _key14++) {
      args[_key14] = arguments[_key14];
    }

    var store = (0, _react.useContext)(storeContext);
    if (isStore(args[0])) {
      return callback.apply(undefined, args);
    }
    return callback.apply(undefined, _toConsumableArray([store].concat(args)));
  };
}

function createStoreHoc(callback, initializer) {
  return function () {
    for (var _len15 = arguments.length, args = Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {
      args[_key15] = arguments[_key15];
    }

    var hasStore = isStore(args[0]);
    // call initializer without store if any
    var initializedData = initializer && initializer.apply(undefined, _toConsumableArray(hasStore ? args.slice(1) : args));

    return function (Component) {
      var MemoComponent = (0, _react.memo)(Component);
      return (0, _react.memo)(function (props) {
        var store = (0, _react.useContext)(storeContext);
        return callback.apply(undefined, [MemoComponent, props, initializedData].concat(_toConsumableArray(hasStore ? args : [store].concat(args))));
      });
    };
  };
}

function isStore(obj) {
  return obj && obj[isStoreProp];
}

function generateId() {
  return uniqueId++;
}
//# sourceMappingURL=index.js.map