export declare type EventBusConfig = {
    name?: any;
    isFrozen?: boolean;
};
export declare type EventBusEvent = {
    eventBusName: string;
    eventName: string;
    data?: any;
};
export declare type EventBusListener = (event: EventBusEvent) => void;
export declare type EventBusDispatcher = (data?: any) => void;
export interface EventBus {
    readonly name: string;
    readonly isLocked: boolean;
    readonly supportEvents: string[];
    registerEvent(eventName: string): EventBusDispatcher;
    dispatch(eventName: string, data?: any): void;
    subscribe(listener: EventBusListener, eventName?: string | string[]): string;
    unsubscribe(id: string): boolean;
    lock(): void;
}
export interface EventBusDevTool {
    onCreate(eventBus: EventBus): void;
    onEvent(event: EventBusEvent): void;
}
export declare function createEventBus<T>(config?: EventBusConfig): EventBus;
export declare function getEventBus(eventBusName: string): EventBus;
export declare function setEventBusDevTool(devTool: Partial<EventBusDevTool>): void;
