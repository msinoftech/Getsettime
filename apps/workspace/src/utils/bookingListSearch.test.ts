import { strict as assert } from 'node:assert';
import {
  buildBookingsSearchOrExpression,
  escapeLikePattern,
} from './bookingListSearch';

function runEscapeTests(): void {
  assert.equal(escapeLikePattern('100%'), '100\\%');
  assert.equal(escapeLikePattern('a_b'), 'a\\_b');
}

function runSearchExpressionTests(): void {
  const nameExpr = buildBookingsSearchOrExpression('Jane Doe');
  assert.ok(nameExpr?.includes('invitee_name.ilike.%Jane Doe%'));
  assert.ok(nameExpr?.includes('invitee_email.ilike.%Jane Doe%'));

  const phoneExpr = buildBookingsSearchOrExpression('9876543210');
  assert.ok(phoneExpr?.includes('invitee_phone.ilike.%9876543210%'));

  const formatted = buildBookingsSearchOrExpression('(987) 654-3210');
  assert.ok(formatted?.includes('invitee_phone.ilike.%9876543210%'));

  const e164 = buildBookingsSearchOrExpression('+91 9876543210');
  assert.ok(e164?.includes('invitee_phone.ilike.%919876543210%'));
  assert.ok(e164?.includes('invitee_phone.ilike.%+919876543210%'));

  assert.equal(buildBookingsSearchOrExpression('  '), null);

  const shortDigits = buildBookingsSearchOrExpression('12');
  assert.ok(shortDigits?.includes('invitee_name.ilike.%12%'));
  assert.ok(!shortDigits?.includes('invitee_phone'));
}

runEscapeTests();
runSearchExpressionTests();
console.log('bookingListSearch.test.ts: ok');
