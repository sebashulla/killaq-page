import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCartItem, changeCartQuantity, parseStoredCart } from '../src/utils/cart.ts';

const item = { id: 'ring', slug: 'ring', name: 'Ring', price: 180, imageUrl: '/ring.png', stock: 3 };
test('Adding repeatedly is capped by product stock', () => {
  const cart = addCartItem(addCartItem([], item, 2), item, 4);
  assert.equal(cart[0].quantity, 3);
});
test('Different ring sizes share the same product stock', () => {
  const cart = addCartItem(addCartItem([], { ...item, size: '6' }, 2), { ...item, size: '7' }, 2);
  assert.deepEqual(cart.map(entry => entry.quantity), [2, 1]);
  assert.equal(changeCartQuantity(cart, 'ring', 5, '7')[1].quantity, 1);
});
test('Sold-out pieces cannot be added', () => assert.deepEqual(addCartItem([], { ...item, stock: 0 }), []));
test('Malformed or obsolete storage never crashes the cart', () => {
  for (const stored of ['bad json', '{}', '[null]', '[1]', '[{"price":-5}]']) assert.deepEqual(parseStoredCart(stored), []);
});
test('Restored cart validates quantities, stock and duplicate entries', () => {
  assert.equal(parseStoredCart(JSON.stringify([{ ...item, quantity: 2 }, { ...item, quantity: 20 }]))[0].quantity, 3);
  assert.equal(parseStoredCart(JSON.stringify([{ ...item, quantity: -1 }])).length, 0);
  assert.equal(parseStoredCart(JSON.stringify([{ ...item, quantity: 1.7 }]))[0].quantity, 1);
});
