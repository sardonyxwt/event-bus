import { deepFreeze, createUniqueIdGenerator } from '@sardonyxwt/utils';

/**
 * @type EventBusConfig
 * @description Initialization config for event bus.
 */
export type EventBusConfig = {
    /**
     * @field name
     * @description Event bus name
     */
    name?: string;
    /**
     * @field isImmutabilityEnabled
     * @description If present event data freezed.
     */
    isImmutabilityEnabled?: boolean;
};

/**
 * @type EventBusEvent
 * @description Event published in event bus.
 */
export type EventBusEvent = {
    /**
     * @field eventBusName
     * @description Event bus name dispatched this event.
     */
    eventBusName: string;
    /**
     * @field eventName
     * @description Event name used to determinate what is event type.
     */
    eventName: string;
    /**
     * @field data
     * @description Event data published with event.
     */
    data?;
};

/**
 * @type EventBusError
 * @description Error catch from subscriber.
 */
export type EventBusError = EventBusEvent & {
    /**
     * @field reason
     * @description Any message to determinate error.
     */
    reason;
};

/**
 * @type EventBusListenerUnsubscribeCallback
 * @description Unsubscribe callback for unsubscribe in future.
 */
export type EventBusListenerUnsubscribeCallback = (() => boolean) & {
    /**
     * @field listenerId
     * @description Listener id for unsubscribe or other communication with event bus.
     */
    listenerId: string;
};

export type EventBusListener = (event: EventBusEvent) => void;
export type EventBusDispatcher<T> = (data?: T) => void;

/**
 * @interface EventBus
 * @description Event bus event system for application modules communication.
 */
export interface EventBus {
    /**
     * @field name
     * @description Event bus unique name.
     */
    readonly name: string;

    /**
     * @field isLocked
     * @description Lock status of event bus.
     * Used to stop new event type registration.
     */
    readonly isLocked: boolean;

    /**
     * @field supportEvents
     * @description All available event types in event bus.
     */
    readonly supportEvents: string[];

    /**
     * @method registerEvent
     * @description Register new event type in event bus.
     * @param eventName {string} Event type name.
     * @returns {EventBusDispatcher} Return event typed dispatcher.
     */
    registerEvent<T = unknown>(eventName: string): EventBusDispatcher<T>;

    /**
     * @method publish
     * @description Publish new event with data.
     * @param eventName {string} Event type to dispatch.
     * @param data {T} Data of event
     */
    publish<T = unknown>(eventName: string, data?: T): void;

    subscribe(
        listener: EventBusListener,
        eventNames?: string[],
    ): EventBusListenerUnsubscribeCallback;

    unsubscribe(id: string): boolean;

    /**
     * @method lock
     * @description Forbid add new event types to event bus.
     */
    lock(): void;
}

/**
 * @interface EventBusDevTool
 * @description Event bus dev tools.
 * @example Use it to print events in console.
 */
export interface EventBusDevTool {
    onCreate(eventBus: EventBus): void;
    onEvent(event: EventBusEvent): void;
    onEventListenerError(error: EventBusError): void;
}

const eventBuses = new Map<string, EventBus>();
const generateEventBusName = createUniqueIdGenerator('EventBus');
const generateEventBusListenerId = createUniqueIdGenerator('EventBusListener');
const eventBusDevTool: EventBusDevTool = {
    onCreate: () => null,
    onEvent: () => null,
    onEventListenerError: () => null,
};

class EventBusImpl implements EventBus {
    public readonly name: string;
    public readonly isImmutabilityEnabled: boolean;

    private _isFrozen = false;
    private _events: string[] = [];
    private _queue: (() => void)[] = [];
    private _listeners = new Map<string, EventBusListener>();

    constructor(config: EventBusConfig) {
        const { name, isImmutabilityEnabled } = config;
        this.name = name;
        this.isImmutabilityEnabled = isImmutabilityEnabled;
    }

    get isLocked() {
        return this._isFrozen;
    }

    get supportEvents() {
        return [...this._events];
    }

    registerEvent<T = unknown>(eventName: string) {
        if (this._isFrozen) {
            throw new Error(
                `This event bus is locked you can't add new event.`,
            );
        }
        if (this.isEventPresent(eventName) || eventName in this) {
            throw new Error(
                `Event with name ${eventName} is duplicate or reserved in event bus ${this.name}.`,
            );
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

        const eventDispatcher = (data?: T) => this.publish(eventName, data);

        this[dispatcherMacroName] = eventDispatcher;

        return eventDispatcher;
    }

    publish<T = unknown>(eventName: string, data?: T) {
        const eventDispatcher = () => {
            if (
                this.isImmutabilityEnabled &&
                !!data &&
                typeof data === 'object'
            ) {
                deepFreeze(data as Record<string, never>);
            }

            const event: EventBusEvent = {
                eventBusName: this.name,
                eventName,
                data,
            };

            eventBusDevTool.onEvent(event);

            this._listeners.forEach((listener) => {
                try {
                    if (listener) {
                        listener(event);
                    }
                } catch (reason) {
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

    subscribe(listener: EventBusListener, eventNames: string[] = []) {
        eventNames.forEach((eventName) => {
            if (!this.isEventPresent(eventName)) {
                throw new Error(`Event (${eventName}) not present in scope.`);
            }
        });

        const listenerId = generateEventBusListenerId();

        const accurateListener = (event) => {
            const isActionPresentInScope =
                eventNames.findIndex(
                    (eventName) => eventName === event.eventName,
                ) !== -1;

            if (isActionPresentInScope) {
                listener(event);
            }
        };

        this._listeners.set(
            listenerId,
            eventNames.length === 0 ? listener : accurateListener,
        );

        return Object.assign(() => this.unsubscribe(listenerId), {
            listenerId,
        });
    }

    unsubscribe(id: string) {
        return this._listeners.delete(id);
    }

    lock() {
        this._isFrozen = true;
    }

    private isEventPresent(eventName: string) {
        return this._events.findIndex((it) => it === eventName) !== -1;
    }
}

/**
 * @function isEventBusExist
 * @description Check if event bus with same name present.
 * @param eventBusName {string} Event bus name to check if event bus registered before.
 * @returns {boolean}
 */
export function isEventBusExist(eventBusName: string): boolean {
    return eventBuses.has(eventBusName);
}

/**
 * @function createEventBus
 * @description Create event bus end register it.
 * @param config {EventBusConfig} Event bus config used to create event bus.
 * @returns {EventBus}
 */
export function createEventBus(config: EventBusConfig = {}): EventBus {
    const {
        name = generateEventBusName(),
        isImmutabilityEnabled = false,
    } = config;
    if (isEventBusExist(name)) {
        throw new Error(`Event bus name must unique`);
    }
    const eventBus = new EventBusImpl({
        name,
        isImmutabilityEnabled,
    });
    eventBuses.set(name, eventBus);
    eventBusDevTool.onCreate(eventBus);
    return eventBus;
}

/**
 * @function getEventBus
 * @description Return event bus if present.
 * @param eventBusName {string} Event bus name.
 * @returns {EventBus}
 */
export function getEventBus(eventBusName: string): EventBus {
    return eventBuses.get(eventBusName);
}

/**
 * @method setEventBusDevTool
 * @description Set event bus dev tools to control how event buses work.
 * @param devTool Dev tools to control how event buses work.
 */
export function setEventBusDevTool(devTool: Partial<EventBusDevTool>): void {
    Object.assign(eventBusDevTool, devTool);
}
