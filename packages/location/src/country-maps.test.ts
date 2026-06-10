import assert from 'node:assert/strict';
import {
  getCurrencyForCountry,
  getPhoneCodeForCountry,
  getTimezoneForCountry,
} from './country-maps';

assert.equal(getPhoneCodeForCountry('IN'), '+91');
assert.equal(getCurrencyForCountry('IN'), 'INR');
assert.equal(getTimezoneForCountry('IN'), 'Asia/Kolkata');
assert.equal(getPhoneCodeForCountry('XX'), '+1');
console.log('country-maps.test.ts: all passed');
