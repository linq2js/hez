"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.createState = createState;
exports.createStore = createStore;
exports.useActions = useActions;
exports.useStore = useStore;
exports.useStoreMemo = useStoreMemo;
exports.withState = withState;
exports.withActions = withActions;
exports.compose = compose;
exports.hoc = hoc;

var _react = require("react");

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

if (!_react.useMemo) {
  throw new Error("This package requires React hooks. Please install React 16.7+");
}

var defaultSelector = function defaultSelector(state) {
  return state;
};

/**
 * create state manager
 */
function createState() {
  var initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var onChange = arguments[1];

  var state = initialState;
  var proxyTarget = initialState;

  function getState(prop) {
    return arguments.length ? typeof prop === "function" ? prop(state) : state[prop] : state;
  }

  function setState() {
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
        state = Array.isArray(state) ? state.slice() : Object.assign({}, state);
        state[prop] = nextValue;
        notify();
      }
    } else {
      var nextState = args[0];
      // support callback
      // state.set(state => doSomething)

      if (typeof nextState === "function") {
        return setState(nextState(state));
      }
      if (state === nextState) {
        return;
      }
      state = nextState;
      notify();
    }
  }

  function notify() {
    Object.assign(proxyTarget, state);
    onChange && onChange(state);
  }

  function mergeState(nextState) {
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

  return new Proxy(proxyTarget, {
    get: function get(target, prop) {
      if (prop === "get") return getState;
      if (prop === "set") return setState;
      if (prop === "merge") return mergeState;
      return proxyTarget[prop];
    }
  });
}

/**
 * create store
 */
function createStore() {
  var initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var subscribers = [];
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

  function getState() {
    return state;
  }

  function createStateForAction(action) {
    return createState(state, function (nextState) {
      state = nextState;
      console.log(111);
      notify(action.displayName || action.name);
    });
  }

  function dispatch(action) {
    dispatchingScopes++;
    try {
      var actions = Array.isArray(action) ? action : [action];
      var lastResult = void 0;

      for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = actions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _action = _step.value;

          lastResult = _action.apply(undefined, [createStateForAction(_action)].concat(args));
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

  return {
    getState: getState,
    dispatch: dispatch,
    subscribe: subscribe
  };
}

function useActions(store) {
  for (var _len3 = arguments.length, actions = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
    actions[_key3 - 1] = arguments[_key3];
  }

  return (0, _react.useMemo)(function () {
    return actions.map(function (action) {
      return function () {
        for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
          args[_key4] = arguments[_key4];
        }

        return store.dispatch.apply(store, [action].concat(args));
      };
    });
  }, [store].concat(actions));
}

function useStore(store) {
  var selector = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultSelector;

  var state = store.getState();
  var globalState = (0, _react.useMemo)(function () {
    return selector(state);
  }, [state]);

  var _useState = (0, _react.useState)(globalState),
      _useState2 = _slicedToArray(_useState, 2),
      localState = _useState2[0],
      setLocalState = _useState2[1];

  for (var _len5 = arguments.length, cacheKeys = Array(_len5 > 2 ? _len5 - 2 : 0), _key5 = 2; _key5 < _len5; _key5++) {
    cacheKeys[_key5 - 2] = arguments[_key5];
  }

  (0, _react.useEffect)(function () {
    return store.subscribe(function (nextState) {
      var nextLocalState = selector(nextState);
      if (nextLocalState !== localState) {
        setLocalState(localState = nextLocalState);
      }
    });
  }, cacheKeys);
  return localState;
}

function useStoreMemo(store, cacheKeysSelector) {
  var stateSelector = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function (state) {
    return state;
  };

  if (Array.isArray(cacheKeysSelector)) {
    var selectors = cacheKeysSelector;
    cacheKeysSelector = function cacheKeysSelector() {
      for (var _len7 = arguments.length, args = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
        args[_key7] = arguments[_key7];
      }

      return selectors.map(function (selector) {
        return selector.apply(undefined, args);
      });
    };
  }

  for (var _len6 = arguments.length, extraCacheKeys = Array(_len6 > 3 ? _len6 - 3 : 0), _key6 = 3; _key6 < _len6; _key6++) {
    extraCacheKeys[_key6 - 3] = arguments[_key6];
  }

  var cacheKeys = useStore(store, cacheKeysSelector).concat(extraCacheKeys);
  return (0, _react.useMemo)(function () {
    return stateSelector.apply(undefined, _toConsumableArray(cacheKeys));
  }, cacheKeys);
}

function withState(store, selector, cacheKeyFactory) {
  return function (Component) {
    var MemoComponent = (0, _react.memo)(Component);

    return (0, _react.memo)(function (props) {
      var nextProps = useStore.apply(undefined, [store, function (state) {
        return selector(state, props);
      }].concat(_toConsumableArray(cacheKeyFactory && cacheKeyFactory(props) || [])));

      return (0, _react.createElement)(MemoComponent, nextProps);
    });
  };
}

function withActions(store, actions) {
  var keys = Object.keys(actions);
  var values = Object.values(actions);
  return function (Component) {
    var MemoComponent = (0, _react.memo)(Component);
    return (0, _react.memo)(function (props) {
      var nextProps = {};
      var mappedActions = useActions.apply(undefined, [store].concat(_toConsumableArray(values)));
      mappedActions.forEach(function (mappedAction, index) {
        return nextProps[keys[index]] = mappedAction;
      });
      return (0, _react.createElement)(MemoComponent, Object.assign(nextProps, props));
    });
  };
}

function compose() {
  for (var _len8 = arguments.length, functions = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
    functions[_key8] = arguments[_key8];
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
  for (var _len9 = arguments.length, callbacks = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
    callbacks[_key9] = arguments[_key9];
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
//# sourceMappingURL=index.js.map