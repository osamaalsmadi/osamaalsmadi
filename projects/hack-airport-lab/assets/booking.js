(function (airport) {
  'use strict';

  const storageKey = 'hack-airport-trips-v1';
  const extras = Object.freeze({ '': 0, meal: 12000, bag: 35000, both: 47000 });
  let memory = [];

  function readTrips() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          memory = saved.filter(item => item && typeof item.reference === 'string' &&
            typeof item.flight === 'string' && typeof item.seat === 'string' &&
            typeof item.passenger === 'string' && Number.isInteger(item.total));
        }
      }
    } catch {}
    return memory;
  }

  function saveTrips(trips) {
    memory = trips;
    try { localStorage.setItem(storageKey, JSON.stringify(trips)); } catch {}
  }

  function hash(text) {
    let value = 2166136261;
    for (const letter of text) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  }

  const flightKey = flight => flight.id + '@' + flight.date;

  function blockedSeats(flight, decks) {
    const key = flightKey(flight);
    const seats = decks.flatMap(deck => deck.rows.flatMap(row => row.seats));
    const scored = seats.map(seat => ({ seat, score: hash(key + '/' + seat.id) }));
    scored.sort((a, b) => a.score - b.score);
    return new Set(scored.slice(Math.round(seats.length * flight.open)).map(item => item.seat.id));
  }

  function reservedSeats(flight) {
    return new Set(readTrips().filter(entry => entry.flight === flightKey(flight)).map(entry => entry.seat));
  }

  function inventory(flight, decks) {
    const blocked = blockedSeats(flight, decks);
    const reserved = reservedSeats(flight);
    const seats = decks.flatMap(deck => deck.rows.flatMap(row => row.seats));
    const available = seats.filter(seat => !blocked.has(seat.id) && !reserved.has(seat.id));
    return { available: available.length, vip: available.filter(seat => airport.isVip(seat.cabin)).length,
      booked: seats.length - available.length };
  }

  function total(flight, seat, extra = '', coupon = false) {
    const base = airport.seatFare(flight, seat);
    return Math.round(base * (coupon ? .75 : 1)) + (extras[extra] || 0);
  }

  function promoAvailable() {
    return !readTrips().some(item => item.promo === 'FIRST25');
  }

  async function reserve({ flight, seat, passenger, extra, method, outcome, coupon, blocked }) {
    const commit = () => {
      const entries = readTrips();
      const key = flightKey(flight);
      if (blocked.has(seat.id) || entries.some(item => item.flight === key && item.seat === seat.id)) {
        return { error: 'That seat was just booked. Choose another seat.' };
      }
      if (!passenger || !Object.hasOwn(extras, extra) || !['card','wallet'].includes(method)) {
        return { error: 'Check your passenger name and booking choices.' };
      }
      if (coupon && entries.some(item => item.promo === 'FIRST25')) {
        return { error: 'FIRST25 has already been used on this browser.' };
      }
      if (outcome !== 'approve') return { error: 'Demo payment declined. You can retry.' };

      const reference = 'HA-' + String(entries.length + 2101).padStart(4, '0');
      const entry = { reference, flight: key, seat: seat.id, cabin: seat.cabin, passenger, extra,
        method, promo: coupon ? 'FIRST25' : '', total: total(flight, seat, extra, coupon) };
      saveTrips([...entries, entry]);
      return { entry };
    };
    if (!globalThis.navigator?.locks) return commit();
    try {
      return await navigator.locks.request(storageKey, commit);
    } catch (error) {
      if (error.name === 'SecurityError' || error.name === 'NotSupportedError') return commit();
      throw error;
    }
  }

  airport.booking = { storageKey, readTrips, flightKey, blockedSeats, reservedSeats, inventory, total, promoAvailable, reserve };
})(HackAirport);
