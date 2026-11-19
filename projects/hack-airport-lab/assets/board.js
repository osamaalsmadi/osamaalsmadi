(function () {
  'use strict';
  const { flights, airports, money, displayDate, seatRows, booking } = HackAirport;
  const el = id => document.getElementById(id);
  const list = el('flight-list');
  const search = el('flight-search');
  const origin = el('origin-filter');
  const featured = flights.find(item => item.id === 'ek904');

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  const hero = node('img', 'terminal-image');
  hero.src = featured.photo;
  hero.alt = '';
  el('hero-photo').append(hero);
  el('hero-caption').textContent = featured.aircraft + ' · ' + featured.carrier;

  const codes = [...new Set(flights.map(flight => flight.from))];
  codes.sort((a, b) => airports[a].city.localeCompare(airports[b].city));
  codes.forEach(code => origin.add(new Option(airports[code].city + ' (' + code + ')', code)));

  function routeStop(flight, field, time) {
    const code = flight[field];
    const box = node('div', 'board-stop');
    box.append(node('strong', '', time), node('span', '', code + ' · ' + airports[code].city));
    return box;
  }

  function card(flight) {
    const entry = node('article', 'flight-row');
    const thumb = node('img', 'flight-thumb');
    thumb.src = flight.photo;
    thumb.alt = '';
    thumb.loading = 'lazy';
    const identity = node('div', 'flight-identity');
    identity.append(thumb);
    const identityText = node('div');
    identityText.append(node('strong', '', flight.number), node('span', '', flight.carrier),
      node('small', '', flight.aircraft));
    identity.append(identityText);

    const route = node('div', 'board-route');
    const track = node('div', 'route-track');
    const trackLine = node('span', 'track-line');
    trackLine.setAttribute('aria-hidden', 'true');
    track.append(node('small', '', flight.duration), trackLine, node('small', '', 'Nonstop'));
    route.append(routeStop(flight, 'from', flight.depart), track,
      routeStop(flight, 'to', flight.arrive));
    const price = node('div', 'board-price');
    const inventory = booking.inventory(flight, seatRows(flight));
    price.append(node('small', '', displayDate(flight.date)), node('strong', '', money(flight.fare)),
      node('small', 'card-availability', inventory.available + ' seats available'));
    const link = node('a', 'button secondary flight-select', 'View flight →');
    link.href = 'flight.html?flight=' + encodeURIComponent(flight.id);
    link.setAttribute('aria-label', 'View flight ' + flight.number + ' to ' + airports[flight.to].city);
    entry.append(identity, route, price, link);
    return entry;
  }

  function render() {
    const term = search.value.toLowerCase().replace(/\s/g, '');
    const matches = flights.filter(flight => {
      const haystack = [flight.number, flight.carrier, flight.aircraft,
        airports[flight.from].city, airports[flight.from].country, flight.from,
        airports[flight.to].city, airports[flight.to].country, flight.to].join(' ').toLowerCase().replace(/\s/g, '');
      return (!origin.value || flight.from === origin.value) && (!term || haystack.includes(term));
    });
    list.replaceChildren(...matches.map(card));
    if (!matches.length) list.append(node('p', 'empty', 'No flights match those filters.'));
    el('flight-count').textContent = matches.length + (matches.length === 1 ? ' flight' : ' flights');
    el('clear-filters').disabled = !search.value && !origin.value;
  }

  search.addEventListener('input', render);
  origin.addEventListener('change', render);
  addEventListener('pageshow', event => { if (event.persisted) render(); });
  addEventListener('storage', event => { if (event.key === booking.storageKey) render(); });
  el('clear-filters').addEventListener('click', () => {
    search.value = origin.value = '';
    render();
    search.focus();
  });
  render();
})();
