import {deepFreeze} from '@sardonyxwt/utils/object';
import {createUniqueIdGenerator} from '@sardonyxwt/utils/generator';

export type EventBusConfig = {
  name?,
  isFrozen?: boolean
};

export type EventBusEvent = {
  eventBusName: string,
  eventName: string,
  data?
};

export type EventBusListenerUnsubscribeCallback = (() => boolean) & {listenerId: string};
export type EventBusListener = (event: EventBusEvent) => void;
export type EventBusDispatcher = (data?) => void;

export interface EventBus {

  readonly name: string;

  readonly isLocked: boolean;

  readonly supportEvents: string[];

  registerEvent(eventName: string): EventBusDispatcher;

  publish(eventName: string, data?): void;

  subscribe(listener: EventBusListener, eventName?: string | string[]): EventBusListenerUnsubscribeCallback;

  unsubscribe(id: string): boolean;

  lock(): void;

}

export interface EventBusDevTool {

  onCreate(eventBus: EventBus): void;

  onEvent(event: EventBusEvent): void;

}

const eventBuses: EventBus[] = [];
const generateEventBusName = createUniqueIdGenerator('EventBus');
const generateEventBusListenerId = createUniqueIdGenerator('EventBusListener');
const eventBusDevTool: EventBusDevTool = {
  onCreate: () => null,
  onEvent: () => null
};

class EventBusImpl implements EventBus {

  private readonly _name: string;
  private _isFrozen: boolean;
  private _events: string[] = [];
  private _queue: Function[] = [];
  private _listeners: { [key: string]: EventBusListener } = {};

  constructor(config: EventBusConfig) {
    const {name, isFrozen} = config;
    this._name = name;
    this._isFrozen = isFrozen;
  }

  get name() {
    return this._name;
  }

  get isLocked() {
    return this._isFrozen;
  }

  get supportEvents() {
    return [...this._events];
  }

  registerEvent(eventName: string) {
    if (this._isFrozen) {
      throw new Error(`This event bus is locked you can't add new event.`);
    }
    if (!!this._events.find(it => it === eventName) || (eventName in this)) {
      throw new Error(`Event with name ${eventName} is duplicate or reserved in event bus ${this._name}.`);
    }
    this._events.push(eventName);

    const capitalizeFirstLetterEventName = () => {
      return eventName.charAt(0).toUpperCase() + eventName.slice(1);
    };

    const subscriberMacroName = `on${capitalizeFirstLetterEventName()}`;
    const dispatcherMacroName = `publish${capitalizeFirstLetterEventName()}`;

    this[subscriberMacroName] = (listener: EventBusListener) => this.subscribe(listener, eventName);

    const eventDispatcher = (data?) => this.publish(eventName, data);

    this[dispatcherMacroName] = eventDispatcher;

    return eventDispatcher;
  }

  publish(eventName: string, data?) {
    const eventDispatcher = () => {
      if (data && typeof data === 'object') {
        deepFreeze(data);
      }

      const event: EventBusEvent = {
        eventBusName: this._name,
        eventName,
        data
      };

      eventBusDevTool.onEvent(event);

      Object.getOwnPropertyNames(this._listeners).forEach(key => {
        const listener = this._listeners[key];
        try {
          if (listener) listener(event);
        } catch (reason) {
          console.error(`Event bus listener ${key} error.`, event);
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

  subscribe(listener: EventBusListener, eventName?: string | string[]) {
    const eventNames: string[] = [];

    if (Array.isArray(eventName)) {
      eventNames.push(...eventName);
    } else if (eventName) {
      eventNames.push(eventName);
    }

    eventNames.forEach(eventName => {
      if (this._events.findIndex(it => it === eventName) === -1) {
        throw new Error(`Event (${eventName}) not present in scope.`);
      }
    });

    const listenerId = generateEventBusListenerId();
    this._listeners[listenerId] = event => {

      if (eventNames.length === 0) {
        return listener(event);
      }

      const isActionPresentInScope = eventNames.findIndex(
        eventName => eventName === event.eventName
      ) !== -1;

      if (isActionPresentInScope) {
        listener(event);
      }
    };
    return Object.assign(() => this.unsubscribe(listenerId), {listenerId});
  }

  unsubscribe(id: string) {
    return delete this._listeners[id];
  }

  lock() {
    this._isFrozen = true;
  }

}

export function isEventBusExist(eventBusName: string) {
  return !!eventBuses.find(it => it.name === eventBusName);
}

export function createEventBus(config: EventBusConfig = {}): EventBus {
  const {
    name = generateEventBusName(),
    isFrozen = false
  } = config;
  if (isEventBusExist(name)) {
    throw new Error(`Event bus name must unique`);
  }
  let eventBus = new EventBusImpl({name, isFrozen});
  eventBuses.push(eventBus);
  eventBusDevTool.onCreate(eventBus);
  return eventBus;
}

export function getEventBus(eventBusName: string) {
  if (!isEventBusExist(eventBusName)) {
    throw new Error(`Event bus with name ${eventBusName} not present`);
  }
  return eventBuses.find(it => it.name === eventBusName);
}

export function setEventBusDevTool(devTool: Partial<EventBusDevTool>) {
  Object.assign(eventBusDevTool, devTool);
}
