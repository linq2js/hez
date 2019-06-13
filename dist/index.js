"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useLoader = exports.withActions = exports.withState = exports.useStoreMemo = exports.useStore = exports.useActions = exports.useAction = exports.noChange = exports.loaderContextProp = exports.objectTypes = exports.objectTypeProp = exports.loaderStatus = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.createState = createState;
exports.createSelector = createSelector;
exports.createStore = createStore;
exports.compose = compose;
exports.hoc = hoc;
exports.Provider = Provider;
exports.createActionGroup = createActionGroup;
exports.getType = getType;
exports.memoize = memoize;
exports.usePromise = usePromise;

var _react = require("react");

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

if (!_react.useMemo) {
  throw new Error("This package requires React hooks. Please install React 16.8+");
}

var loaderStatus = exports.loaderStatus = {
  new: 0,
  loading: 1,
  success: 2,
  fail: 3
};
var defaultSelector = function defaultSelector(state) {
  return state;
};
var storeContext = (0, _react.createContext)(null);
var objectTypeProp = exports.objectTypeProp = "@@objectType";
var objectTypes = exports.objectTypes = {
  store: 1,
  actionGroup: 2
};
var defaultInjectedProps = {};
var defaultState = {};
var noop = function noop() {};
var loaderContextProp = exports.loaderContextProp = "@@context";
var noChange = exports.noChange = {};
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

    if (args.length === 2 && (typeof args[0] !== "function" || args[0].___selector)) {
      // support state prop modifier
      // state.set('count', x => x + 1)
      var prop = args[0],
          modifier = args[1];

      var prevValue = state[prop];
      var nextValue = typeof modifier === "function" ? modifier(prevValue) : modifier;
      if (nextValue !== prevValue) {
        // clone current state
        var nextState = Array.isArray(state) ? state.slice() : Object.assign({}, state);
        nextState[prop] = nextValue;
        notify(nextState);
      }
    } else {
      var _nextState = resolveNextState(state, args);
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

  function resolveNextState(state, args) {
    if (typeof args[0] !== "function" || args.length < 2) {
      return args[0];
    }
    var resolvedPropValues = args.slice(0, args.length - 1).map(function (selector) {
      return selector(state);
    });
    return args[args.length - 1].apply(null, resolvedPropValues);
  }

  function mergeState() {
    var state = stateAccessor();

    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var nextState = resolveNextState(state, args);
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
    for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
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
            for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
              args[_key4] = arguments[_key4];
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

function createSelector() {
  for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
    args[_key5] = arguments[_key5];
  }

  // create computed selector
  if (args.length > 1 && typeof args[1] === "function") {
    var selectors = args.slice(0, args.length - 1).map(function (selector) {
      return createSelector(selector);
    });
    var lastInputs = void 0,
        lastResult = void 0;
    return createSelector(function (state) {
      var inputs = selectors.map(function (s) {
        return s(state);
      });
      // do not call selector twice if inputs does not change
      if (typeof lastInputs !== "undefined" && inputs.every(function (value, index) {
        return lastInputs[index] === value;
      })) {
        return lastResult;
      }
      lastInputs = inputs;
      return lastResult = args[args.length - 1].apply(null, inputs);
    });
  }

  var selector = args[0],
      defaultValue = args[1];

  if (typeof selector === "string") {
    return Object.assign(createSelector(function (state) {
      // return prop name if no state specified
      if (typeof state === "undefined") return selector;
      return state[selector];
    }, defaultValue), {
      toString: function toString() {
        return selector;
      }
    });
  }

  // avoid re-wrap selector multiple times
  if (selector.___selector) return selector;

  return Object.assign(function (state) {
    var propValue = selector(state);
    if (typeof propValue === "undefined") {
      return defaultValue;
    }

    return propValue;
  }, {
    ___selector: true
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
  var dispatchers = new WeakMap();
  var store = _defineProperty({
    getState: getState,
    dispatch: dispatch,
    subscribe: subscribe,
    inject: inject,
    use: use,
    getDispatcher: getDispatcher
  }, objectTypeProp, objectTypes.store);
  var hasActionSubscription = void 0;
  var state = initialState;
  var lastDispatchedAction = void 0;
  var shouldNotify = false;
  var dispatchingScopes = 0;

  function getDispatcher(action) {
    var dispatcher = dispatchers.get(action);
    if (!dispatcher) {
      dispatcher = function dispatcher() {
        for (var _len6 = arguments.length, args = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
          args[_key6] = arguments[_key6];
        }

        return dispatch.apply(undefined, [action].concat(args));
      };
      dispatchers.set(action, dispatcher);
    }

    return dispatcher;
  }

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
    var name = typeof action === "function" ? getType(action) : String(action);
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
    var name = typeof action === "function" ? getType(action) : String(action);
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
      notify(getType(action));
    }, stateProps, addActionListener);
  }

  function use(middleware) {
    middlewares.push(middleware);
  }

  function dispatch(action) {
    for (var _len7 = arguments.length, args = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
      args[_key7 - 1] = arguments[_key7];
    }

    return middlewares.reduce(function (next, middleware) {
      return function (action) {
        for (var _len8 = arguments.length, args = Array(_len8 > 1 ? _len8 - 1 : 0), _key8 = 1; _key8 < _len8; _key8++) {
          args[_key8 - 1] = arguments[_key8];
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

      for (var _len9 = arguments.length, args = Array(_len9 > 1 ? _len9 - 1 : 0), _key9 = 1; _key9 < _len9; _key9++) {
        args[_key9 - 1] = arguments[_key9];
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

var useAction = exports.useAction = function useAction() {
  return useActions.apply(undefined, arguments)[0];
};

/**
 * useActions(store, ...actions)
 * useActions(...actions)
 */
var useActions = exports.useActions = createStoreUtility(function (store) {
  for (var _len10 = arguments.length, actions = Array(_len10 > 1 ? _len10 - 1 : 0), _key10 = 1; _key10 < _len10; _key10++) {
    actions[_key10 - 1] = arguments[_key10];
  }

  return (0, _react.useMemo)(function () {
    if (typeof actions[0] !== "function") {
      var actionGroup = actions[0];
      var isReducerGroup = Object.keys(actionGroup).every(function (key) {
        return typeof actionGroup[key] === "function";
      });
      var cachedActions = {};
      return actions.slice(1).map(function (actionType) {
        return function (payload) {
          if (!(actionType in cachedActions)) {
            var action = actionGroup[actionType];
            // actionGroup contains multiple reducers
            // { prop1: reducer1, prop2: reducer2 }
            if (isReducerGroup) {
              cachedActions[actionType] = function (state, payload) {
                state.reduce(actionGroup, {
                  type: actionType,
                  payload: payload
                });
              };
            } else {
              cachedActions[actionType] = function (state, payload) {
                state.reduce(action, { type: actionType, payload: payload });
              };
            }
            cachedActions[actionType].displayName = actionType;
          }

          return store.dispatch(cachedActions[actionType], payload);
        };
      });
    }

    return actions.map(function (action) {
      return store.getDispatcher(action);
    });
  }, [store].concat(actions));
});

/**
 * useStore(store, selector, ...cacheKeys)
 * useStore(selector, ...cacheKeys)
 * useStore(selectors, ...cacheKeys)
 * useStore(store, selectors, ...cacheKeys)
 */
var useStore = exports.useStore = createStoreUtility(function (store) {
  for (var _len11 = arguments.length, cacheKeys = Array(_len11 > 2 ? _len11 - 2 : 0), _key11 = 2; _key11 < _len11; _key11++) {
    cacheKeys[_key11 - 2] = arguments[_key11];
  }

  var selector = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultSelector;

  var isMultipleSelectors = Array.isArray(selector);
  // extract selector keys if it is plain object
  var selectorKeys = isMultipleSelectors || typeof selector === "function" ? undefined : Object.keys(selector);
  var state = store.getState();
  var selectorWrapper = function selectorWrapper(state) {
    return isMultipleSelectors ? // extract multiple state values
    selector.map(function (subSelector) {
      return subSelector(state);
    }) : selectorKeys ? // extract values by object keys
    selectorKeys.reduce(function (obj, key) {
      obj[key] = selector[key](state);
      return obj;
    }, {}) // extract single value
    : selector(state);
  };

  var globalState = (0, _react.useMemo)(function () {
    return selectorWrapper(state);
  }, [state]);

  var _useState = (0, _react.useState)(globalState),
      _useState2 = _slicedToArray(_useState, 2),
      localState = _useState2[0],
      setLocalState = _useState2[1];

  (0, _react.useLayoutEffect)(function () {
    return store.subscribe(function (nextState) {
      var nextLocalState = selectorWrapper(nextState);
      // detect change
      var hasChange = isMultipleSelectors ? // compare local array and next array
      localState.some(function (localValue, index) {
        return nextLocalState[index] !== localValue;
      }) : selectorKeys ? selectorKeys.some(function (key) {
        return localState[key] !== nextLocalState[key];
      }) : nextLocalState !== localState;

      if (hasChange) {
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
  for (var _len12 = arguments.length, extraCacheKeys = Array(_len12 > 3 ? _len12 - 3 : 0), _key12 = 3; _key12 < _len12; _key12++) {
    extraCacheKeys[_key12 - 3] = arguments[_key12];
  }

  var stateSelector = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function (state) {
    return state;
  };

  if (Array.isArray(cacheKeysSelector)) {
    var selectors = cacheKeysSelector;
    cacheKeysSelector = function cacheKeysSelector() {
      for (var _len13 = arguments.length, args = Array(_len13), _key13 = 0; _key13 < _len13; _key13++) {
        args[_key13] = arguments[_key13];
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
  for (var _len14 = arguments.length, functions = Array(_len14), _key14 = 0; _key14 < _len14; _key14++) {
    functions[_key14] = arguments[_key14];
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
  for (var _len15 = arguments.length, callbacks = Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {
    callbacks[_key15] = arguments[_key15];
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

function createActionGroup(actions) {
  return actions;
}

function getType(action) {
  if (typeof action !== "function") {
    throw new Error("Invalid action. Action should be function type");
  }
  if (!action.displayName && action.name) {
    action.displayName = action.name + "." + generateId();
  }

  return action.displayName;
}

function memoize(f) {
  var lastResult = void 0;
  var lastArgs = void 0;

  return function () {
    for (var _len16 = arguments.length, args = Array(_len16), _key16 = 0; _key16 < _len16; _key16++) {
      args[_key16] = arguments[_key16];
    }

    // call f on first time or args changed
    if (!lastArgs || lastArgs.some(function (value, index) {
      return value !== args[index];
    })) {
      lastArgs = args;
      lastResult = f.apply(undefined, _toConsumableArray(lastArgs));
    }
    return lastResult;
  };
}

function usePromise(factory) {
  var cacheKeys = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  var effect = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      var result;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              if (!(typeof currentValue !== "undefined" && defaultValue === currentValue)) {
                _context.next = 2;
                break;
              }

              return _context.abrupt("return");

            case 2:
              _context.prev = 2;
              _context.next = 5;
              return factory.apply(undefined, _toConsumableArray(cacheKeys));

            case 5:
              result = _context.sent;

              !isUnmount && setState({
                result: result
              });

              onSuccess && onSuccess.apply(undefined, [result].concat(_toConsumableArray(cacheKeys)));
              _context.next = 14;
              break;

            case 10:
              _context.prev = 10;
              _context.t0 = _context["catch"](2);

              !isUnmount && setState({
                error: _context.t0
              });

              onFailure && onFailure.apply(undefined, [_context.t0].concat(_toConsumableArray(cacheKeys)));

            case 14:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this, [[2, 10]]);
    }));

    return function effect() {
      return _ref4.apply(this, arguments);
    };
  }();

  var _ref3 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      defaultValue = _ref3.defaultValue,
      onSuccess = _ref3.onSuccess,
      onFailure = _ref3.onFailure,
      currentValue = _ref3.currentValue;

  var _useState3 = (0, _react.useState)({ result: defaultValue }),
      _useState4 = _slicedToArray(_useState3, 2),
      state = _useState4[0],
      setState = _useState4[1];

  var isUnmount = false;

  (0, _react.useLayoutEffect)(function () {
    effect();

    return function () {
      isUnmount = true;
    };
  }, cacheKeys);

  return [state.result, state.error];
}

function createStoreUtility(callback) {
  return function () {
    for (var _len17 = arguments.length, args = Array(_len17), _key17 = 0; _key17 < _len17; _key17++) {
      args[_key17] = arguments[_key17];
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
    for (var _len18 = arguments.length, args = Array(_len18), _key18 = 0; _key18 < _len18; _key18++) {
      args[_key18] = arguments[_key18];
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
  return obj && obj[objectTypeProp] === objectTypes.store;
}

function generateId() {
  return uniqueId++;
}

/**
 * function loaderFactory(state, ...args) {
 *   return {
 *     loader: () => object,
 *     keys: [cacheKey1, cacheKey2],
 *     defaultValue: object
 *   }
 * }
 */
var useLoader = exports.useLoader = createStoreUtility(function (store, loaderFactory) {
  for (var _len19 = arguments.length, args = Array(_len19 > 2 ? _len19 - 2 : 0), _key19 = 2; _key19 < _len19; _key19++) {
    args[_key19 - 2] = arguments[_key19];
  }

  var contextRef = (0, _react.useRef)(evalLoaderContext(store, loaderFactory, args));

  var _useState5 = (0, _react.useState)(),
      _useState6 = _slicedToArray(_useState5, 2),
      setState = _useState6[1];

  function forceRender() {
    setState({});
  }

  (0, _react.useEffect)(function () {
    // loader triggered by another component, we just listen when data loaded
    if (!tryExecuteLoader(contextRef, store, forceRender)) {
      if (contextRef.current.status === loaderStatus.loading) {
        // re-render component once data loaded
        contextRef.current.promise.then(forceRender);
      }
    }
  });

  (0, _react.useEffect)(function () {
    return store.subscribe(function () {
      contextRef.current = evalLoaderContext(store, loaderFactory, args);
      // there are somethings changed in cache keys, we should re-render component
      if (contextRef.current.status === loaderStatus.new) {
        forceRender();
      }
    });
  });

  return contextRef.current.project ? contextRef.current.project(contextRef.current) : contextRef.current;
});

function tryExecuteLoader(contextRef, store, forceRender) {
  var _this = this;

  if (contextRef.current.status === loaderStatus.new) {
    contextRef.current.status = loaderStatus.loading;
    // using object as lock to make sure loader was triggered in same phase
    // another triggering will create diff lock object so we must not re-render component
    var lock = contextRef.current;
    clearTimeout(contextRef.current.timerId);
    contextRef.current.promise = new Promise(function (resolve, reject) {
      contextRef.current.timerId = setTimeout(_asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var requiredLoaders, requiredLoaderResults, payload;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (!(lock !== contextRef.current)) {
                  _context2.next = 2;
                  break;
                }

                return _context2.abrupt("return");

              case 2:
                requiredLoaders = contextRef.current.require.map(function (loaderFactory) {
                  var ref = {
                    current: evalLoaderContext(store, loaderFactory)
                  };
                  tryExecuteLoader(ref, store, forceRender);
                  return ref.current.promise;
                });
                _context2.next = 5;
                return Promise.all(requiredLoaders);

              case 5:
                requiredLoaderResults = _context2.sent;
                _context2.prev = 6;
                _context2.next = 9;
                return store.dispatch.apply(store, [contextRef.current.loader].concat(_toConsumableArray(requiredLoaderResults), _toConsumableArray(contextRef.current.keys)));

              case 9:
                payload = _context2.sent;

                if (!(lock !== contextRef.current)) {
                  _context2.next = 12;
                  break;
                }

                return _context2.abrupt("return");

              case 12:

                contextRef.current.payload =
                // sometimes you dont want to update payload, just keep prev one
                payload === noChange ? contextRef.current.prevPayload : payload;
                contextRef.current.status = loaderStatus.success;
                setTimeout(function () {
                  return resolve(contextRef.current.payload);
                });
                _context2.next = 23;
                break;

              case 17:
                _context2.prev = 17;
                _context2.t0 = _context2["catch"](6);

                if (!(lock !== contextRef.current)) {
                  _context2.next = 21;
                  break;
                }

                return _context2.abrupt("return");

              case 21:
                contextRef.current.status = loaderStatus.fail;
                setTimeout(function () {
                  return reject(_context2.t0);
                });

              case 23:
                _context2.prev = 23;

                if (lock === contextRef.current) {
                  contextRef.current.done = true;
                  forceRender();
                }
                return _context2.finish(23);

              case 26:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, _this, [[6, 17, 23, 26]]);
      })), contextRef.current.debounce);
    });

    return true;
  }
  return false;
}

function evalLoaderContext(store, loaderFactory) {
  var args = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  var _ref6 = store.dispatch.apply(store, [loaderFactory].concat(_toConsumableArray(args))) || {},
      loader = _ref6.loader,
      _ref6$keys = _ref6.keys,
      keys = _ref6$keys === undefined ? [] : _ref6$keys,
      _ref6$require = _ref6.require,
      require = _ref6$require === undefined ? [] : _ref6$require,
      defaultValue = _ref6.defaultValue,
      _ref6$debounce = _ref6.debounce,
      debounce = _ref6$debounce === undefined ? 50 : _ref6$debounce,
      project = _ref6.project;

  var context = loaderFactory[loaderContextProp];

  if (!context ||
  // verify keys are modified or not
  context.keys.length !== keys.length || context.keys.some(function (x, i) {
    return x !== keys[i];
  })) {
    return loaderFactory[loaderContextProp] = context = {
      keys: keys,
      require: require,
      status: loaderStatus.new,
      done: false,
      defaultValue: defaultValue,
      loader: loader,
      debounce: debounce,
      project: project,
      prevPayload: context ? context.payload : undefined,
      forceReload: function forceReload() {
        if (!context) return;
        delete loaderFactory[loaderContextProp];
        context = null;
        store.dispatch(function (state) {
          state.set(_extends({}, store.getState()));
        });
      }
    };
  }

  return context;
}
//# sourceMappingURL=index.js.map