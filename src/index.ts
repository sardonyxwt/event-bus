import {deepFreeze} from '@sardonyxwt/utils/object';
import {createUniqueIdGenerator} from '@sardonyxwt/utils/generator';

export type EventBusConfig = {
    name?: string;
    isFrozen?: boolean;
    isImmutabilityEnabled?: boolean;
};

export type EventBusEvent = {
    eventBusName: string;
    eventName: string;
    data?;
};

export type ScopeError<T = any> = EventBusEvent & {
    reason;
};

export type EventBusListenerUnsubscribeCallback = (() => boolean) & { listenerId: string };
export type EventBusListener = (event: EventBusEvent) => void;
export type EventBusDispatcher = (data?) => void;

export interface EventBus {
    readonly name: string;
    readonly isLocked: boolean;
    readonly supportEvents: string[];

    registerEvent(eventName: string): EventBusDispatcher;
    publish(eventName: string, data?): void;
    subscribe(listener: EventBusListener, eventNames?: string[]): EventBusListenerUnsubscribeCallback;
    unsubscribe(id: string): boolean;
    lock(): void;
}

export interface EventBusDevTool {
    onCreate(eventBus: EventBus): void;
    onEvent(event: EventBusEvent): void;
    onEventListenerError(error: ScopeError): void;
}

const eventBuses = new Map<string, EventBus>();
const generateEventBusName = createUniqueIdGenerator('EventBus');
const generateEventBusListenerId = createUniqueIdGenerator('EventBusListener');
const eventBusDevTool: EventBusDevTool = {
    onCreate: () => null,
    onEvent: () => null,
    onEventListenerError: () => null
};

class EventBusImpl implements EventBus {

    public readonly name: string;
    public readonly isImmutabilityEnabled: boolean;

    private _isFrozen: boolean;
    private _events: string[] = [];
    private _queue: Function[] = [];
    private _listeners = new Map<string, EventBusListener>();

    constructor(config: EventBusConfig) {
        const {name, isFrozen, isImmutabilityEnabled} = config;
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

    registerEvent(eventName: string) {
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

        this[subscriberMacroName] = (listener: EventBusListener) => {
            this.subscribe(listener, [eventName]);
        };

        const eventDispatcher = (data?) => this.publish(eventName, data);

        this[dispatcherMacroName] = eventDispatcher;

        return eventDispatcher;
    }

    publish(eventName: string, data?) {
        const eventDispatcher = () => {
            if (this.isImmutabilityEnabled && !!data && typeof data === 'object') {
                deepFreeze(data);
            }

            const event: EventBusEvent = {
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
                } catch (reason) {
                    eventBusDevTool.onEventListenerError({...event, reason});
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

    subscribe(listener: EventBusListener, eventNames: string[] = []) {
        eventNames.forEach(eventName => {
            if (!this.isEventPresent(eventName)) {
                throw new Error(`Event (${eventName}) not present in scope.`);
            }
        });

        const listenerId = generateEventBusListenerId();

        const accurateListener = event => {
            const isActionPresentInScope = eventNames.findIndex(
                eventName => eventName === event.eventName
            ) !== -1;

            if (isActionPresentInScope) {
                listener(event);
            }
        };

        this._listeners.set(listenerId, eventNames.length === 0 ? listener : accurateListener);

        return Object.assign(() => this.unsubscribe(listenerId), {listenerId});
    }

    unsubscribe(id: string) {
        return this._listeners.delete(id);
    }

    lock() {
        this._isFrozen = true;
    }

    private isEventPresent(eventName: string) {
        return  this._events.findIndex(it => it === eventName) !== -1;
    }

}

export function isEventBusExist(eventBusName: string): boolean {
    return eventBuses.has(eventBusName);
}

export function createEventBus(config: EventBusConfig = {}): EventBus {
    const {
        name = generateEventBusName(),
        isFrozen = false,
        isImmutabilityEnabled = false
    } = config;
    if (isEventBusExist(name)) {
        throw new Error(`Event bus name must unique`);
    }
    let eventBus = new EventBusImpl({name, isFrozen, isImmutabilityEnabled});
    eventBuses.set(name, eventBus);
    eventBusDevTool.onCreate(eventBus);
    return eventBus;
}

export function getEventBus(eventBusName: string): EventBus {
    return eventBuses.get(eventBusName);
}

export function setEventBusDevTool(devTool: Partial<EventBusDevTool>) {
    Object.assign(eventBusDevTool, devTool);
}
