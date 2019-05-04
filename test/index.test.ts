import {createEventBus, EventBus, EventBusListenerUnsubscribeCallback} from "../src";

describe('EventBus', () => {

  const TEST_VALUE = 1000;
  const EVENT_NAME = 'testEvent';

  let eventBus: EventBus;
  let unsubscribeCallback: EventBusListenerUnsubscribeCallback;

  it('createEventBus', () => {
    eventBus = createEventBus({name: 'TestEventBus'});
  });

  it('registerEvent', () => {
    eventBus.registerEvent(EVENT_NAME);
  });

  it('lock', () => {
    eventBus.lock();
    try {
      eventBus.registerEvent('testLock');
    } catch (err) {
      expect(err).toBeTruthy();
    }
  });

  it('isLocked', () => {
    expect(eventBus.isLocked).toEqual(true);
  });

  it('subscribe', () => {
    unsubscribeCallback = eventBus.subscribe(evt => {
      expect(evt.data).toEqual(TEST_VALUE);
    });
  });

  it('publish', () => {
    eventBus.publish(EVENT_NAME, TEST_VALUE);
  });

  it('unsubscribe', () => {
    unsubscribeCallback();
  });


  it('getSupportEvents', () => {
    expect(eventBus.supportEvents).toEqual([EVENT_NAME]);
  });

});
