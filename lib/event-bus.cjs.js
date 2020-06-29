'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const generateSalt = (length = 16, sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => {
    let result = '';
    while (result.length < length) {
        result += sample.charAt(Math.floor(Math.random() * sample.length));
    }
    return result;
};
const generateUUID = () => `${generateSalt(4)}-${generateSalt(4)}-${generateSalt(4)}-${generateSalt(4)}`;
const createUniqueIdGenerator = (prefix) => {
    let index = 0;
    const uuid = generateUUID();
    const uniquePrefix = `${prefix}:${uuid}`;
    return () => `${uniquePrefix}:${++index}`;
};

function deepFreeze(obj) {
    Object.getOwnPropertyNames(obj).forEach(function (key) {
        let prop = obj[key];
        if (typeof prop === 'object' && prop !== null) {
            deepFreeze(prop);
        }
    });
    return Object.freeze(obj);
}

const eventBuses = new Map();
const generateEventBusName = createUniqueIdGenerator('EventBus');
const generateEventBusListenerId = createUniqueIdGenerator('EventBusListener');
const eventBusDevTool = {
    onCreate: () => null,
    onEvent: () => null,
    onEventListenerError: () => null
};
class EventBusImpl {
    constructor(config) {
        this._events = [];
        this._queue = [];
        this._listeners = new Map();
        const { name, isFrozen, isImmutabilityEnabled } = config;
        this.name = name;
        this.isImmutabilityEnabled = isImmutabilityEnabled;
        this._isFrozen = isFrozen;
    }
    get isLocked() {
        return this._isFrozen;
    }
    get supportEvents() {
        return [...this._events];
    }
    registerEvent(eventName) {
        if (this._isFrozen) {
            throw new Error(`This event bus is locked you can't add new event.`);
        }
        if (this.isEventPresent(eventName) || (eventName in this)) {
            throw new Error(`Event with name ${eventName} is duplicate or reserved in event bus ${this.name}.`);
        }
        this._events.push(eventName);
        const capitalizeFirstLetterEventName = () => {
            return eventName.charAt(0).toUpperCase() + eventName.slice(1);
        };
        const subscriberMacroName = `on${capitalizeFirstLetterEventName()}`;
        const dispatcherMacroName = `publish${capitalizeFirstLetterEventName()}`;
        this[subscriberMacroName] = (listener) => {
            this.subscribe(listener, [eventName]);
        };
        const eventDispatcher = (data) => this.publish(eventName, data);
        this[dispatcherMacroName] = eventDispatcher;
        return eventDispatcher;
    }
    publish(eventName, data) {
        const eventDispatcher = () => {
            if (this.isImmutabilityEnabled && !!data && typeof data === 'object') {
                deepFreeze(data);
            }
            const event = {
                eventBusName: this.name,
                eventName,
                data
            };
            eventBusDevTool.onEvent(event);
            this._listeners.forEach(listener => {
                try {
                    if (listener) {
                        listener(event);
                    }
                }
                catch (reason) {
                    eventBusDevTool.onEventListenerError({ ...event, reason });
                }
            });
            this._queue.shift();
            if (this._queue.length > 0) {
                const nextEventDispatcher = this._queue[0];
                nextEventDispatcher();
            }
        };
        const isFirstInQuery = this._queue.length === 0;
        this._queue.push(eventDispatcher);
        if (isFirstInQuery) {
            eventDispatcher();
        }
    }
    subscribe(listener, eventNames = []) {
        eventNames.forEach(eventName => {
            if (!this.isEventPresent(eventName)) {
                throw new Error(`Event (${eventName}) not present in scope.`);
            }
        });
        const listenerId = generateEventBusListenerId();
        const accurateListener = event => {
            const isActionPresentInScope = eventNames.findIndex(eventName => eventName === event.eventName) !== -1;
            if (isActionPresentInScope) {
                listener(event);
            }
        };
        this._listeners.set(listenerId, eventNames.length === 0 ? listener : accurateListener);
        return Object.assign(() => this.unsubscribe(listenerId), { listenerId });
    }
    unsubscribe(id) {
        return this._listeners.delete(id);
    }
    lock() {
        this._isFrozen = true;
    }
    isEventPresent(eventName) {
        return this._events.findIndex(it => it === eventName) !== -1;
    }
}
function isEventBusExist(eventBusName) {
    return eventBuses.has(eventBusName);
}
function createEventBus(config = {}) {
    const { name = generateEventBusName(), isFrozen = false, isImmutabilityEnabled = false } = config;
    if (isEventBusExist(name)) {
        throw new Error(`Event bus name must unique`);
    }
    let eventBus = new EventBusImpl({ name, isFrozen, isImmutabilityEnabled });
    eventBuses.set(name, eventBus);
    eventBusDevTool.onCreate(eventBus);
    return eventBus;
}
function getEventBus(eventBusName) {
    return eventBuses.get(eventBusName);
}
function setEventBusDevTool(devTool) {
    Object.assign(eventBusDevTool, devTool);
}

exports.createEventBus = createEventBus;
exports.getEventBus = getEventBus;
exports.isEventBusExist = isEventBusExist;
exports.setEventBusDevTool = setEventBusDevTool;
