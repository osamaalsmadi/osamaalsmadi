(function (global) {
  'use strict';

  const buyer = Object.freeze({ id: 'customer-ava', name: 'Ava Morgan', role: 'customer' });
  const operator = Object.freeze({ id: 'operator-kit', name: 'Kit Ellis', role: 'operator' });
  const identities = Object.freeze({ buyer, operator });
  const cartId = 'FARE-4821';
  const promo = 'FIRST25';
  const api = Object.freeze({
    ticket: '/api/tickets/',
    admin: '/api/admin/fares',
    coupon: '/api/checkouts/' + cartId + '/coupons'
  });

  function initial(flight, demoSeats) {
    return {
      flight: { id: flight.id, number: flight.number, from: flight.from, to: flight.to },
      tickets: [
        { id: 'HA-1042', ownerId: buyer.id, passenger: buyer.name, seat: demoSeats[0].id, totalFils: flight.fare },
        { id: 'HA-1043', ownerId: 'customer-noah', passenger: 'Noah Park', seat: demoSeats[1].id, totalFils: flight.fare },
        { id: 'HA-1044', ownerId: 'customer-mira', passenger: 'Mira Chen', seat: demoSeats[2].id, totalFils: flight.fare }
      ],
      priceFils: flight.fare,
      cart: null
    };
  }

  function answer(status, body) {
    return { status, body };
  }

  function failure(status, message) {
    return answer(status, { message });
  }

  function lookupTicket(model, id) {
    return model.tickets.find(ticket => ticket.id === id);
  }

  function ticketResponse(model, ticket) {
    return answer(200, {
      bookingId: ticket.id, passenger: ticket.passenger, flight: model.flight.number, from: model.flight.from, to: model.flight.to,
      seat: ticket.seat, paidFils: ticket.totalFils, currency: 'JOD'
    });
  }

  function readTicket(model, id) {
    const ticket = lookupTicket(model, id);
    if (!ticket) {
      return failure(404, 'Booking not found.');
    }
    // The URL selects the record, and existence is the only check.
    return ticketResponse(model, ticket);
  }

  function readOwnedTicket(model, id, actor) {
    const ticket = lookupTicket(model, id);
    if (!ticket || ticket.ownerId !== actor.id) {
      return failure(404, 'Booking not found.');
    }
    // A matching reference only works for the session that owns it.
    return ticketResponse(model, ticket);
  }

  function pricing(model) {
    return answer(200, { flightId: model.flight.id, flight: model.flight.number,
      priceFils: model.priceFils, currency: 'JOD' });
  }

  function validPrice(body) {
    return Number.isInteger(body.priceFils) && body.priceFils >= 500 &&
      body.priceFils <= 2000000;
  }

  function adminPricing(model, request) {
    if (request.method === 'GET') {
      return pricing(model);
    }
    if (!validPrice(request.body)) {
      return failure(422, 'Enter a fare from JOD 0.50 to JOD 2,000.00.');
    }
    model.priceFils = request.body.priceFils;
    return pricing(model);
  }

  function authorizedPricing(model, request, actor) {
    if (actor.role !== 'operator') {
      return failure(403, 'An operator session is required.');
    }
    if (request.method === 'GET') {
      return pricing(model);
    }
    if (!validPrice(request.body)) {
      return failure(422, 'Enter a fare from JOD 0.50 to JOD 2,000.00.');
    }
    model.priceFils = request.body.priceFils;
    return pricing(model);
  }

  function cartResponse(cart) {
    return answer(200, { cartId, currency: 'JOD', subtotalFils: cart.subtotalFils,
      totalFils: cart.totalFils, savingsFils: cart.subtotalFils - cart.totalFils,
      appliedCodes: [...cart.appliedCodes] });
  }

  function openCart(model) {
    model.cart = { subtotalFils: model.priceFils, totalFils: model.priceFils, appliedCodes: [] };
    return cartResponse(model.cart);
  }

  function applyCoupon(cart, code) {
    if (code !== promo) {
      return failure(422, 'That promotion is unavailable.');
    }
    // Reapply the offer even when it is already on this checkout.
    cart.appliedCodes.push(code);
    cart.totalFils = Math.round(cart.totalFils * 0.75);
    return cartResponse(cart);
  }

  function applyCouponOnce(cart, code) {
    if (code !== promo) {
      return failure(422, 'That promotion is unavailable.');
    }
    if (cart.appliedCodes.includes(code)) {
      return failure(409, 'This promotion is already applied to this checkout.');
    }
    cart.appliedCodes.push(code);
    cart.totalFils = Math.round(cart.subtotalFils * 0.75);
    return cartResponse(cart);
  }

  const handlers = Object.freeze({
    idor: [readTicket, readOwnedTicket],
    admin: [adminPricing, authorizedPricing],
    coupon: [applyCoupon, applyCouponOnce]
  });

  function dispatch(kind, model, request, actor, fixed) {
    const { method, path, body } = request;
    const handle = handlers[kind][Number(fixed)];
    if (kind === 'idor' && path.startsWith(api.ticket)) {
      if (method !== 'GET') return failure(405, 'Use GET for ticket reads.');
      return handle(model, path.slice(api.ticket.length), actor);
    }
    if (kind === 'admin' && path === api.admin) {
      if (!['GET', 'PATCH'].includes(method)) return failure(405, 'Use GET or PATCH for pricing.');
      return handle(model, request, actor);
    }
    if (kind === 'coupon' && path === api.coupon) {
      if (method !== 'POST') return failure(405, 'Use POST for coupons.');
      if (!model.cart) return failure(409, 'Open a checkout before applying a coupon.');
      const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
      return handle(model.cart, code);
    }
    return failure(404, 'No matching route in this lab.');
  }

  function exploited(kind, before, response, actor) {
    if (response.status !== 200) return false;
    if (kind === 'idor') return response.body.passenger !== actor.name;
    if (kind === 'admin') return actor.role !== 'operator';
    return before.cart.appliedCodes.length > 0 &&
      response.body.totalFils < before.cart.totalFils;
  }

  global.HackAirportSecurity = { api, cartId, promo, identities, initial, openCart,
    dispatch, exploited, snippets: handlers };
})(globalThis);
