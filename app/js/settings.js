/* @flow */
/* global TW */

import tabmanager from './tabmanager';

const Settings = {
  cache: {},

  defaults: {
    // How often we check for old tabs.
    checkInterval: 5000,

    // wait 1 second before updating an active tab
    debounceOnActivated: false,

    // Don't close tabs that are playing audio.
    filterAudio: false,

    // An array of tabids which have been explicitly locked by the user.
    lockedIds: [],

    // Just to keep memory / UI in check. No UI for this.
    maxTabs: 100,

    // Stop acting if there are only minTabs tabs open.
    minTabs: 5,

    // How many minutes (+ secondsInactive) before we consider a tab "stale" and ready to close.
    minutesInactive: 20,

    // If TabWrangler is paused (won't count down)
    paused: false,

    // Save closed tabs in between browser sessions.
    purgeClosedTabs: false,

    // Whether to reset all tab timers between browser sessions.
    purgeTabTimes: false,

    // How many seconds (+ minutesInactive) before a tab is "stale" and ready to close.
    secondsInactive: 0,

    // Save closed tabs in between browser sessions.
    showBadgeCount: true,

    // An array of patterns to check against.  If a URL matches a pattern, it is never locked.
    whitelist: ['chrome://'],

    // We allow duplicate entries in the closed/wrangled tabs list
    wrangleOption: 'withDupes',
  },

  // Gets all settings from sync and stores them locally.
  init(): Promise<void> {
    const keys = [];
    for (const i in this.defaults) {
      if (this.defaults.hasOwnProperty(i)) {
        this.cache[i] = this.defaults[i];
        keys.push(i);
      }
    }

    const complete = new Promise(resolve => {
      chrome.storage.sync.get(keys, items => {
        for (const i in items) {
          if (items.hasOwnProperty(i)) {
            this.cache[i] = items[i];
          }
        }
        resolve();
      });
    });

    return complete;
  },

  /**
   * Either calls a getter function or returns directly from storage.
   */
  get(key: string): mixed {
    if (typeof this[key] == 'function') {
      return this[key]();
    }
    return this.cache[key];
  },

  /**
   * Sets a value in localStorage. Can also call a setter. If the value is a struct
   * (object or array) it is JSONified.
   */
  set(key: string, value: mixed): void {
    // Magic setter functions are set{fieldname}
    if (typeof this['set' + key] == 'function') {
      this['set' + key](value);
    } else {
      Settings.setValue(key, value);
    }
  },

  /**
   * @see Settings.set
   */
  setmaxTabs(value: string) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) < 1 || parseInt(value, 10) > 500 ) {
      throw Error(
        chrome.i18n.getMessage('settings_setmaxTabs_error') ||
        'Error: settings.setmaxTabs'
      );
    }
    Settings.setValue('maxTabs', value);
  },

  /**
   * @see Settings.set
   */
  setminTabs(value: string) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0 ) {
      throw Error(
        chrome.i18n.getMessage('settings_setminTabs_error') ||
        'Error: settings.setminTabs'
      );
    }
    Settings.setValue('minTabs', value);
  },

  /**
   * @see Settings.set
   */
  setminutesInactive(value: string): void {
    const minutes = parseInt(value, 10);
    if (isNaN(minutes) || minutes < 0) {
      throw Error(
        chrome.i18n.getMessage('settings_setminutesInactive_error') ||
        'Error: settings.setminutesInactive'
      );
    }

    // Reset the tabTimes since we changed the setting
    TW.storageLocal.set('tabTimes', {});
    chrome.tabs.query({windowType: 'normal'}, tabmanager.initTabs);
    Settings.setValue('minutesInactive', value);
  },

  /**
   * @see Settings.set
   */
  setsecondsInactive(value: string): void {
    const seconds = parseInt(value, 10);
    if ( isNaN(seconds) || seconds < 0 || seconds > 59 ) {
      throw Error(
        chrome.i18n.getMessage('settings_setsecondsInactive_error') ||
        'Error: setsecondsInactive'
      );
    }

    // Reset the tabTimes since we changed the setting
    TW.storageLocal.set('tabTimes', {});
    chrome.tabs.query({windowType: 'normal'}, tabmanager.initTabs);
    Settings.setValue('secondsInactive', value);
  },

  setpaused(value: boolean) {
    if (value === false) {
      // The user has just unpaused, immediately set all tabs to the current time
      // so they will not be closed.
      chrome.tabs.query({
        windowType: 'normal',
      }, tabmanager.initTabs);
    }
    Settings.setValue('paused', value);
  },

  setshowBadgeCount(value: boolean) {
    if (value === false) {
      // Clear out the current badge setting
      chrome.browserAction.setBadgeText({text: ''});
    }
    Settings.setValue('showBadgeCount', value);
    tabmanager.updateClosedCount();
  },

  setValue(key: string, value: mixed, fx?: () => void) {
    this.cache[key] = value;
    chrome.storage.sync.set({[key]: value}, fx);
  },

  /**
   * Returns the number of milliseconds that tabs should stay open for without being used.
   */
  stayOpen(): number {
    return (
      parseInt(this.get('minutesInactive'), 10) * 60000 + // minutes
      parseInt(this.get('secondsInactive'), 10) * 1000 // seconds
    );
  },
};

export default Settings;
