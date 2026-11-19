(function () {
  'use strict';

  const { flights, layouts, airports, seatRows, money, displayDate, seatFare, booking, Cabin, FullDeck, isVip } = HackAirport;
  const el = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const flight = flights.find(item => item.id === params.get('flight'));
  if (!flight) {
    location.replace('index.html#departures');
    return;
  }
  const layout = layouts[flight.layout];
  const decks = seatRows(flight);
  const allRows = decks.flatMap(deck => deck.rows);
  const blocked = booking.blockedSeats(flight, decks);
  const sheet = el('payment-dialog');
  const allSeats = allRows.flatMap(row => row.seats);
  const count = allSeats.length;
  const origin = airports[flight.from], destination = airports[flight.to];
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cabin = new Cabin(el('cabin-canvas'), el('hotspots'), chooseSeat);
  let reserved = booking.reservedSeats(flight);
  let selected = null;
  let deck = decks[0];
  let segments = [];
  let segmentIndex = 0;
  let format = cabin.ctx ? 'full' : '2d';
  let camera = 'overview';
  let coupon = false;
  let confirming = false;
  let flatButtons = new Map();
  const fullDecks = new Map();
  const classes = new Map();
  const interiors = {
    e195: ['rj-e195-e2', 'Embraer E195-E2 reference cabin', 'Embraer_E195-E2_Interior.jpg'],
    a321: ['tk-a321neo', 'Airbus A321neo economy · American Airlines reference', 'American_Airlines_Airbus_A321neo_economy_cabin_2.jpg'],
    a380: ['ek-a380', 'Airbus A380 economy · Emirates reference', 'A380_interior.jpg'],
    b777: ['ek-777-300er', 'Boeing 777-300ER economy · Emirates reference', 'Emirates_Economy_Class_777_interior.jpg'],
    a350: ['qr-a350-900', 'Airbus A350-900 economy · Air France reference', 'Air_France_Airbus_A350-900_F-HUVJ_economy_interior_May_2025.jpg'],
    b787: ['rj-787-8', 'Boeing 787-8 economy · Zipair Tokyo reference', 'Zipair_Tokyo_Boeing_787-8_JA824J_economy_interior_June_2025.jpg']
  };
  const a380Business = ['ek-a380-business', 'Airbus A380 Business · Emirates reference', 'Emirates_business_class_A380.jpg'];

  function text(id, str) {
    el(id).textContent = str;
  }

  function feedback(id, message = '', error = false) {
    text(id, message);
    el(id).dataset.error = String(error);
  }

  function node(tag, content, className) {
    const item = document.createElement(tag);
    if (content) item.textContent = content;
    if (className) item.className = className;
    return item;
  }

  const route = origin.city + ' → ' + destination.city;
  document.title = flight.number + ' · ' + route + ' | Hack Airport';
  text('flight-brand', flight.carrier + ' · ' + flight.number);
  text('route-title', route);
  text('from', flight.depart + ' · ' + flight.from);
  text('to', flight.arrive + ' · ' + flight.to);
  text('departure-date', displayDate(flight.date) + ' · ' + origin.offset + ' · ' + origin.name);
  text('arrival-date', displayDate(flight.date) + ' · ' + destination.offset + ' · ' + destination.name);
  text('duration', flight.duration);
  text('aircraft-title', flight.aircraft);
  text('aircraft-subtitle', flight.carrier + ' · ' + count + ' seats · ' + (decks.length === 2 ? '2 passenger decks' : '1 passenger deck'));
  el('aircraft-image').src = flight.photo;
  el('aircraft-image').alt = flight.aircraft + ' operated by ' + flight.carrier;
  el('photo-source').href = flight.photoCredit;
  el('seat-source').href = layout.source;
  el('schedule-source').href = flight.schedule;
  document.querySelectorAll('[data-lab-link]').forEach(link => {
    const target = new URL(link.href);
    target.searchParams.set('flight', flight.id);
    link.href = target.href;
  });
  text('layout-detail', layout.name + ' · Complete seat map, from the first row to the last.');

  for (const entry of decks) el('deck-select').add(new Option(entry.name, entry.id));
  document.querySelector('[data-format="3d"]').disabled = !cabin.ctx;
  document.querySelector('[data-format="full"]').disabled = !cabin.ctx;
  document.querySelector('[data-format="fit"]').disabled = !cabin.ctx;

  function state(seat) {
    return blocked.has(seat.id) || reserved.has(seat.id) ? 'booked' : seat.id === selected?.id ? 'selected' : 'available';
  }

  function seatStats(seats) {
    const available = seats.filter(seat => state(seat) !== 'booked');
    return { open: available.length, vip: available.filter(seat => isVip(seat.cabin)).length,
      booked: seats.length - available.length };
  }

  function buildFullCabin() {
    const target = el('render-full');
    const links = el('deck-links');
    for (const entry of decks) {
      const wrapper = node('section','','full-deck');
      wrapper.id = 'deck-'+entry.id;
      const heading = node('div','','deck-header');
      const title = node('h3',entry.name);
      title.id = 'deck-name-'+entry.id;
      wrapper.setAttribute('aria-labelledby',title.id);
      const countLabel = node('span');
      const position = node('div','','deck-stage');
      heading.append(title,countLabel);
      wrapper.append(heading,position);
      target.append(wrapper);
      const map = new FullDeck(position,entry,layout,state,chooseSeat);
      fullDecks.set(entry.id,{map,countLabel,seats:entry.rows.flatMap(row=>row.seats)});
      if (decks.length>1) {
        const link = node('a',entry.name);
        link.href = '#'+wrapper.id;
        links.append(link);
      } else {
        links.append(node('span','All rows'));
      }
    }
  }

  function buildClasses() {
    for (const seat of allSeats) {
      if (!classes.has(seat.cabin)) classes.set(seat.cabin, {seats:[], label:node('span')});
      classes.get(seat.cabin).seats.push(seat);
    }
    for (const [name,{label}] of classes) {
      const item = node('div','','class-item');
      const title = node('strong',name);
      if (isVip(name)) title.append(node('b','VIP','vip-label'));
      item.append(title,label);
      el('class-list').append(item);
    }
  }

  function renderPhoto() {
    const [slug,caption,credit] = flight.layout==='a380' && selected?.cabin==='Business' ?
      a380Business : interiors[flight.layout];
    const photo = 'assets/interiors/'+slug+'.webp';
    const image = el('inside-image');
    if (image.getAttribute('src')!==photo) {
      image.src=photo;
      image.alt=caption;
      text('inside-caption',caption);
      el('inside-source').href='https://commons.wikimedia.org/wiki/File:'+credit;
    }
    el('inside-photo').hidden = false;
  }

  function splitRows(source) {
    const result = [];
    let current = [];
    for (const row of source) {
      if (current.length && (current.length >= 11 || current[0].cabin !== row.cabin)) {
        result.push(current);
        current = [];
      }
      current.push(row);
    }
    if (current.length) result.push(current);
    return result;
  }

  function rowLabel(rows) {
    const first = rows[0], last = rows.at(-1);
    return first === last ? 'Row ' + first.number : 'Rows ' + first.number + '–' + last.number;
  }

  function connectDeck() {
    segments = splitRows(deck.rows);
    const picker = el('zone-select');
    picker.replaceChildren();
    segments.forEach((items,index) => picker.add(new Option(rowLabel(items) + ' · ' + items[0].cabin,String(index))));
    segmentIndex = selected ? Math.max(0, segments.findIndex(segment => segment.some(row => row.number === selected.row))) : 0;
    selectSegment(segmentIndex);
    buildFlat();
  }

  function selectSegment(index) {
    segmentIndex = Math.min(segments.length - 1, Math.max(0,index));
    el('zone-select').value = String(segmentIndex);
    el('prev-zone').disabled = segmentIndex === 0;
    el('next-zone').disabled = segmentIndex === segments.length - 1;
    const visibleRows = segments[segmentIndex];
    text('zone-summary', rowLabel(visibleRows) + ' of ' + deck.name.toLowerCase());
    if (format==='3d' && cabin.ctx) cabin.setRows(deck, visibleRows, layout, state);
    camera = 'overview';
    cameraLabels();
    renderSelection();
  }

  function currentRangeHasSeat() {
    return Boolean(selected && selected.deck === deck.id && segments[segmentIndex]?.some(row => row.number === selected.row));
  }

  function setCamera(mode) {
    if (!cabin.ctx || (mode === 'seat' && !currentRangeHasSeat())) return;
    camera = mode;
    cabin.setCamera(mode,selected?.id);
    cameraLabels();
  }

  function cameraLabels() {
    const names = { overview: 'Cabin overview', aisle: 'Aisle view',
      focus: selected ? 'Seat ' + selected.id : 'Seat preview',
      seat: selected ? 'View from ' + selected.id : 'View from seat' };
    text('camera-caption',names[camera]);
    document.querySelectorAll('[data-camera]').forEach(button => {
      button.disabled = button.dataset.camera === 'seat' && !currentRangeHasSeat();
      button.setAttribute('aria-pressed',String(button.dataset.camera === camera));
    });
  }

  function buildFlat() {
    const grid = el('render-2d');
    const content = [node('span','Front of aircraft','flat-header')];
    flatButtons = new Map();
    let previous = '';
    for (const row of deck.rows) {
      if (row.cabin !== previous) {
        previous = row.cabin;
        const cabinTitle = node('h3',row.cabin,'flat-class');
        if (isVip(row.cabin)) cabinTitle.append(node('b','VIP','vip-label'));
        content.push(cabinTitle);
      }
      const entry = node('div','','flat-row');
      const columns = row.full.reduce((sum,block) => sum + block.length,0) + row.full.length-1;
      entry.style.setProperty('--cols',String(columns));
      const header = node('strong',String(row.number));
      header.title = row.exit ? 'Exit row' : 'Row '+row.number;
      entry.append(header);
      row.full.forEach((block,i) => {
        if (i) entry.append(node('span'));
        const seats = row.seats.filter(seat => seat.block === i);
        for (const letter of block) {
          const seat = seats.find(entry => entry.letter === letter);
          if (!seat) {
            entry.append(node('span'));
            continue;
          }
          const button = node('button',letter);
          button.type = 'button';
          button.dataset.seat = seat.id;
          button.addEventListener('click',() => chooseSeat(seat));
          flatButtons.set(seat.id, { button, seat });
          entry.append(button);
        }
      });
      content.push(entry);
    }
    grid.replaceChildren(...content);
    renderFlat();
  }

  function renderFlat() {
    for (const {button,seat} of flatButtons.values()) {
      const result = state(seat);
      button.disabled = result === 'booked';
      button.classList.toggle('selected', result === 'selected');
      button.classList.toggle('vip-seat', isVip(seat.cabin));
      button.setAttribute('aria-pressed', String(result === 'selected'));
      button.setAttribute('aria-label', 'Seat '+seat.id+', '+seat.cabin+(isVip(seat.cabin)?' VIP':'')+', '+result);
    }
  }

  function chooseSeat(seat) {
    if (state(seat) === 'booked') return;
    selected = seat;
    feedback('booking-feedback');
    if (format === '3d') setCamera('focus');
    renderSelection();
  }

  function renderSelection() {
    const aircraft = seatStats(allSeats);
    text('aircraft-open',aircraft.open);
    text('aircraft-vip',aircraft.vip);
    text('aircraft-booked',aircraft.booked);
    const scope = ['full','fit'].includes(format) ? aircraft : seatStats(deck.rows.flatMap(row=>row.seats));
    text('availability', scope.open+' available · '+scope.vip+' VIP');
    el('seat-details').hidden = !selected;
    el('continue-booking').disabled = !selected || confirming;
    el('preview-seat').disabled = !selected || !cabin.ctx;
    text('seat-kicker', selected ? 'SEAT '+selected.id+' · '+decks.find(item=>item.id===selected.deck).name.toUpperCase() : 'NO SEAT SELECTED');
    el('seat-kicker').classList.toggle('vip-location',Boolean(selected && isVip(selected.cabin)));
    text('seat-message', selected ? flight.number+' · '+route : 'Pick an available seat on the cabin map.');
    if (selected) {
      text('selected-seat',selected.id);
      text('selected-class',selected.cabin+(isVip(selected.cabin)?' · VIP':'')+(selected.exit?' · Exit row':''));
      text('selected-fare',money(seatFare(flight,selected)));
    }
    for (const {map,countLabel,seats} of fullDecks.values()) {
      const group = seatStats(seats);
      countLabel.textContent = group.open+' of '+seats.length+' available';
      if (format==='full' || format==='fit') map.update();
    }
    for (const {seats,label} of classes.values()) {
      const group = seatStats(seats);
      label.textContent = group.open+' available';
    }
    renderPhoto();
    renderFlat();
    if (format==='3d' && cabin.segment) cabin.update();
    cameraLabels();
  }

  function setFormat(next) {
    format = next;
    document.querySelectorAll('[data-format]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.format===next));
    });
    const full = next==='full' || next==='fit';
    el('render-full').hidden = !full;
    el('render-full').classList.toggle('is-fit',next==='fit');
    el('render-3d').hidden = next!=='3d';
    el('render-2d').hidden = next!=='2d';
    el('deck-field').hidden = full || decks.length===1;
    el('deck-links').hidden = next!=='full';
    el('zone-field').hidden = next!=='3d';
    if (full) {
      for (const {map} of fullDecks.values()) map.setFit(next==='fit');
      if (next==='fit') el('render-full').scrollTop=0;
      renderSelection();
      return;
    }
    if (selected && next==='3d') deck = decks.find(item=>item.id===selected.deck);
    el('deck-select').value=deck.id;
    connectDeck();
    if (next==='3d') {
      cabin.resize();
      setCamera(currentRangeHasSeat() ? 'focus' : 'overview');
    }
  }

  el('preview-seat').addEventListener('click', () => {
    if (!selected) return;
    setFormat('3d');
    setCamera('seat');
    el('cabin-title').focus({preventScroll:true});
    el('cabin').scrollIntoView({behavior:quiet?'instant':'smooth'});
  });
  el('deck-select').addEventListener('change',event => {
    deck = decks.find(item => item.id === event.target.value);
    connectDeck();
  });
  el('zone-select').addEventListener('change',event => selectSegment(Number(event.target.value)));
  el('prev-zone').addEventListener('click',()=>selectSegment(segmentIndex-1));
  el('next-zone').addEventListener('click',()=>selectSegment(segmentIndex+1));
  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click',()=>setCamera(button.dataset.camera)));
  document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click',()=>setFormat(button.dataset.format)));

  const renderTotal = () => {
    if (selected) text('payment-total',money(booking.total(flight,selected,el('extras').value,coupon)));
  };
  el('continue-booking').addEventListener('click', () => {
    if (!selected) return;
    el('payment-form').reset();
    coupon = false;
    feedback('promo-feedback');
    feedback('payment-feedback');
    text('payment-seat', flight.number+' · '+route+' · Seat '+selected.id);
    renderTotal();
    sheet.showModal();
  });
  el('cancel-booking').addEventListener('click', () => sheet.close());
  el('extras').addEventListener('change',renderTotal);
  el('promo-code').addEventListener('input', () => {
    coupon = false;
    feedback('promo-feedback');
    renderTotal();
  });

  function applyPromo() {
    const code = el('promo-code').value.trim().toUpperCase();
    coupon = code === 'FIRST25' && booking.promoAvailable();
    const message = coupon ? 'FIRST25 applied · 25% off the fare.' :
      code === 'FIRST25' ? 'FIRST25 has already been used.' : 'Promotion code unavailable.';
    feedback('promo-feedback',message,!coupon);
    renderTotal();
  }

  el('apply-promotion').addEventListener('click',applyPromo);
  el('promo-code').addEventListener('keydown',event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyPromo();
  });

  el('payment-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!selected || confirming) return;
    const submit = event.submitter || el('payment-form').querySelector('[type="submit"]');
    confirming = true;
    submit.disabled = true;
    try {
      const result = await booking.reserve({
        flight, seat:selected, blocked, coupon, passenger:el('passenger').value.trim(),
        extra:el('extras').value, method:el('payment-method').value, outcome:el('payment-outcome').value
      });
      if (result.error) {
        feedback('payment-feedback',result.error,true);
        return;
      }
      reserved = booking.reservedSeats(flight);
      selected = null;
      sheet.close();
      camera = 'overview';
      if (format==='3d') cabin.setCamera(camera,null,false);
      feedback('booking-feedback','Confirmed · Boarding pass '+result.entry.reference);
      renderTrips();
    } catch {
      feedback('payment-feedback','The demo booking could not be completed. Try again.',true);
    } finally {
      confirming = false;
      submit.disabled = false;
      renderSelection();
    }
  });

  function renderTrips() {
    const list = el('trip-list');
    const trips = booking.readTrips();
    const cards = [];
    for (const item of [...trips].reverse()) {
      const tripFlight = flights.find(entry => booking.flightKey(entry) === item.flight);
      if (!tripFlight) continue;
      const card = node('article','','trip-card');
      const routeText = airports[tripFlight.from].city+' → '+airports[tripFlight.to].city;
      const meta = node('div');
      meta.append(node('strong', item.reference+' · '+tripFlight.number+' · '+routeText),
        node('p', displayDate(tripFlight.date)+' · '+tripFlight.depart+' · '+item.passenger),
        node('p','Seat '+item.seat+' · '+item.cabin+' · '+money(item.total)));
      const pass = node('details');
      pass.append(node('summary','Boarding pass'),node('p',tripFlight.from+' → '+tripFlight.to+' · '+item.seat),
        node('p','Demo reservation '+item.reference));
      card.append(meta,pass);
      cards.push(card);
    }
    list.replaceChildren(...cards);
    if (!cards.length) list.append(node('p','No trips yet. Book a seat to get a demo boarding pass.','empty'));
  }

  addEventListener('storage',event => {
    if (event.key !== booking.storageKey) return;
    reserved = booking.reservedSeats(flight);
    if (selected && reserved.has(selected.id) && !sheet.open) selected = null;
    renderTrips();
    if (!el('cabin').hidden) renderSelection();
  });
  if (cabin.ctx) buildFullCabin();
  buildClasses();
  setFormat(format);
  renderTrips();
})();
