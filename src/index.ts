import {deepFreeze} from '@sardonyxwt/utils/object';
import {uniqueId} from '@sardonyxwt/utils/generator';

export type EventBusConfig = {
  name?,
  isFrozen?: boolean
};

export type EventBusEvent = {
  eventBusName: string,
  eventName: string,
  data?
};

export type EventBusListener = (event: EventBusEvent) => void;
export type EventBusDispatcher = (data?) => void;

export interface EventBus {

  readonly name: string;

  readonly isLocked: boolean;

  readonly supportEvents: string[];

  registerEvent(eventName: string): EventBusDispatcher;

  dispatch(eventName: string, data?): void;

  subscribe(listener: EventBusListener, eventName?: string | string[]): string;

  unsubscribe(id: string): boolean;

  lock(): void;

}

export interface EventBusDevTool {

  onCreate(eventBus: EventBus): void;

  onEvent(event: EventBusEvent): void;

}

let eventBusDevTool: EventBusDevTool = {
  onCreate: () => null,
  onEvent: () => null
};

class EventBusImpl implements EventBus {

  protected readonly _name: string;
  protected _isFrozen: boolean;
  protected _events: string[] = [];
  protected _listeners: { [key: string]: EventBusListener } = {};

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

    this[subscriberMacroName] = (listener: EventBusListener) => this.subscribe(listener, eventName);

    const eventDispatcher = (data?) => this.dispatch(eventName, data);

    this[eventName] = eventDispatcher;

    return eventDispatcher;
  }

  dispatch(eventName: string, data?) {
    if (data && typeof data === 'object') {
      deepFreeze(data);
    }

    const onFulfilled = () => {
      const event: EventBusEvent = {
        eventBusName: this._name,
        eventName,
        data
      };

      const dispatchEvent = (event: EventBusEvent) => {
        eventBusDevTool.onEvent(event);
        Object.getOwnPropertyNames(this._listeners).forEach(key => {
          const listener = this._listeners[key];
          try {
            if (listener) listener(event);
          } catch (reason) {
            console.error(`Event bus listener ${key} error.`, event)
          }
        });
      };

      dispatchEvent(event);
    };

    onFulfilled();
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

    const listenerId = uniqueId('listener');
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
    return listenerId;
  }

  unsubscribe(id: string) {
    return delete this._listeners[id];
  }

  lock() {
    this._isFrozen = true;
  }

}

const eventBuses: { [key: string]: EventBus } = {};

export function createEventBus<T>(config: EventBusConfig = {}): EventBus {
  const {
    name = uniqueId('eventBus'),
    isFrozen = false
  } = config;
  if (name in eventBuses) {
    throw new Error(`Event bus name must unique`);
  }
  let eventBus = new EventBusImpl({name, isFrozen});
  eventBuses[name] = eventBus;
  eventBusDevTool.onCreate(eventBus);
  return eventBus;
}

export function getEventBus(eventBusName: string) {
  if (!eventBuses[eventBusName]) {
    throw new Error(`Event bus with name ${eventBusName} not present`);
  }
  return eventBuses[eventBusName];
}

export function setEventBusDevTool(devTool: Partial<EventBusDevTool>) {
  Object.assign(eventBusDevTool, devTool);
}
