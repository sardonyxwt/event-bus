export declare type EventBusConfig = {
    name?: string;
    isFrozen?: boolean;
    isImmutabilityEnabled?: boolean;
};
export declare type EventBusEvent = {
    eventBusName: string;
    eventName: string;
    data?: any;
};
export declare type ScopeError<T = any> = EventBusEvent & {
    reason: any;
};
export declare type EventBusListenerUnsubscribeCallback = (() => boolean) & {
    listenerId: string;
};
export declare type EventBusListener = (event: EventBusEvent) => void;
export declare type EventBusDispatcher = (data?: any) => void;
export interface EventBus {
    readonly name: string;
    readonly isLocked: boolean;
    readonly supportEvents: string[];
    registerEvent(eventName: string): EventBusDispatcher;
    publish(eventName: string, data?: any): void;
    subscribe(listener: EventBusListener, eventNames?: string[]): EventBusListenerUnsubscribeCallback;
    unsubscribe(id: string): boolean;
    lock(): void;
}
export interface EventBusDevTool {
    onCreate(eventBus: EventBus): void;
    onEvent(event: EventBusEvent): void;
    onEventListenerError(error: ScopeError): void;
}
export declare function isEventBusExist(eventBusName: string): boolean;
export declare function createEventBus(config?: EventBusConfig): EventBus;
export declare function getEventBus(eventBusName: string): EventBus;
export declare function setEventBusDevTool(devTool: Partial<EventBusDevTool>): void;
