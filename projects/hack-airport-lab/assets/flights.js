(function (global) {
  'use strict';

  const airports = Object.freeze({
    AMM: { city: 'Amman', country: 'Jordan', name: 'Queen Alia International', offset: 'UTC+03' },
    BEY: { city: 'Beirut', country: 'Lebanon', name: 'Beirut–Rafic Hariri International', offset: 'UTC+02' },
    IST: { city: 'Istanbul', country: 'Türkiye', name: 'Istanbul Airport', offset: 'UTC+03' },
    JFK: { city: 'New York', country: 'United States', name: 'John F. Kennedy International', offset: 'UTC−05' },
    DXB: { city: 'Dubai', country: 'United Arab Emirates', name: 'Dubai International', offset: 'UTC+04' },
    MLE: { city: 'Malé', country: 'Maldives', name: 'Velana International', offset: 'UTC+05' },
    DOH: { city: 'Doha', country: 'Qatar', name: 'Hamad International', offset: 'UTC+03' },
    SIN: { city: 'Singapore', country: 'Singapore', name: 'Singapore Changi', offset: 'UTC+08' }
  });

  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const groups = layout => layout.split(' ');
  const rows = (cabin, numbers, full, alternatives = {}, exits = [], rear = []) => numbers.map(number => ({
    number, cabin, full: groups(full), groups: groups(alternatives[number] || full),
    exit: exits.includes(number), rearFacing: rear.includes(number)
  }));
  const deck = (id, name, ...sections) => ({ id, name, rows: sections.flat() });
  const alternating = (numbers, even, odd) => Object.fromEntries(numbers.map(number => [number, number % 2 ? odd : even]));

  const upper380 = [
    rows('First', range(1, 4), 'A EF K', { 4: 'A - K' }),
    rows('Business', range(6, 26).filter(n => n !== 13), 'AB DEFG JK', {
      ...Object.fromEntries([7,9,11,14,16,18,20,23,25].map(n => [n, 'A EF K'])),
      ...Object.fromEntries([8,10,12,15,17,19,21,24,26].map(n => [n, 'B DG J'])),
      6: '- DG -', 22: '- DG -'
    }, [6, 22])
  ];
  const layouts = Object.freeze({
    e195: {
      name: 'E195-E2 · 122-seat variant', source: 'https://knowmyseat.com/aircraft/rj-royal-jordanian--e195-e2-v-2',
      width: 2.74, window: 'oval', seat: '#4c4b5d', premium: '#563c4b', wall: '#d4d4d7', doors: '#7e243f', floor: '#22263b',
      decks: [deck('main', 'Main deck', rows('Crown', range(1, 3), 'AC HK'),
        rows('Economy', range(11, 38), 'AC HK', { 38: 'AC -' }, [19]))]
    },
    a321: {
      name: 'A321neo · 190-seat 32Q-2', source: 'https://www.aerolopa.com/tk-32q-2',
      width: 3.70, window: 'oval', seat: '#425278', premium: '#4a394f', wall: '#ded9d5', doors: '#b04f5a', floor: '#263149',
      decks: [deck('main', 'Main deck', rows('Business', range(1, 4), 'AB EF'),
        rows('Economy', range(6, 34), 'ABC DEF', {}, [15, 16]))]
    },
    b787: {
      name: '787-8 · 270-seat Dreamliner', source: 'https://seatmap.org/en/airlines/royal-jordanian/royal-jordanian-boeing-787-8-788',
      width: 5.49, window: 'dreamliner', seat: '#4d5369', premium: '#5d4857', wall: '#d5dae5', doors: '#843955', floor: '#293048',
      decks: [deck('main', 'Main deck', rows('Crown', range(1, 4), 'AC DG HK'),
        rows('Economy', [...range(5, 20), ...range(25, 37)], 'ABC DEF GHK', {
          25: 'ABC - GHK', 35: 'BC DEF GH', 36: 'BC DEF -', 37: '- DEF -'
        }, [25]))]
    },
    a380: {
      name: 'A380-800 · 484-seat 388Y', source: 'https://www.aerolopa.com/ek-388y',
      width: 6.58, window: 'oval', seat: '#586778', premium: '#7b5b49', wall: '#e6dece', doors: '#965550', floor: '#3a3741',
      decks: [
        deck('main', 'Main deck', rows('Premium Economy', range(33, 40), 'AB DEFG JK', {
          33: 'AB - JK', 34: 'AB - JK'
        }), rows('Economy', range(52, 88), 'ABC DEFG HJK', {
          52: '- - HJK', 53: 'ABC - HJK', 66: 'ABC - -', 67: 'BC DEFG HJ',
          79: 'ABC - HJK', 80: 'ABC - HJK', 88: 'ABC - HJK'
        }, [52, 53, 67, 80])),
        { ...deck('upper', 'Upper deck', ...upper380), width: 5.92 }
      ]
    },
    b777: {
      name: '777-300ER · 328-seat 77WS', source: 'https://www.aerolopa.com/ek-77ws',
      width: 5.86, window: 'oval', seat: '#635971', premium: '#786456', wall: '#e2dad4', doors: '#885657', floor: '#2b3146',
      decks: [deck('main', 'Main deck',
        rows('First', [1, 2], 'A EF K'),
        rows('Business', range(3, 12), 'AB DEFG JK', {
          ...Object.fromEntries(range(3, 12).map(n => [n, 'A EF K'])),
          4: 'B DG J', 7: 'B DG J', 9: 'B DG J', 11: 'B DG J'
        }),
        rows('Premium Economy', range(14, 16), 'AB DEFG JK'),
        rows('Economy', range(23, 50), 'ABC DEFG HJK', {
          23: '- DEFG -', 37: 'ABC - HJK', 46: 'AB DEFG JK', 47: 'AB DEFG JK',
          48: 'AB DEFG JK', 49: 'AB DEFG JK', 50: 'AB - JK'
        }, [24, 37]))]
    },
    a350: {
      name: 'A350-900 · 283-seat Qsuite', source: 'https://www.qatarairways.com/content/dam/documents/fleet/archive/Qsuite-A350-900.pdf',
      width: 5.61, window: 'wide', seat: '#63445f', premium: '#73576e', wall: '#ded9e6', doors: '#90446d', floor: '#331f3e',
      decks: [deck('main', 'Main deck',
        rows('Qsuite', range(1, 9), 'AB DEFG JK', alternating(range(1, 9), 'B DG J', 'A EF K'), [], [1,3,5,7,9]),
        rows('Economy', range(16, 44), 'ABC DEF HJK', {
          16: 'AC DEF HK', 29: 'ABC - HJK', 30: 'ABC - HJK', 44: '- DEF -'
        }, [30]))]
    }
  });

  const photoFiles = {
    rj407: ['rj-e195-e2', 'Royal_Jordanian%2C_JY-REB%2C_Embraer_E195-E2_%2854013618440%29.jpg'],
    tk815: ['tk-a321neo', 'Turkish_Airlines%2C_TC-LTN%2C_Airbus_A321-271NX.jpg'],
    rj261: ['rj-787-8', 'Royal_Jordanian%2C_JY-BAE%2C_Boeing_787-8_Dreamliner_%2825082749977%29.jpg'],
    ek904: ['ek-a380', 'Emirates_A380_In_Flight.jpg'],
    ek660: ['ek-777-300er', 'Hamburg_Airport_Emirates_Boeing_777-31HER_A6-ENG_%28DSC07216%29.jpg'],
    qr944: ['qr-a350-900', 'Qatar_A350_at_Edinburgh.jpg']
  };

  const flights = [
    { id: 'rj407', number: 'RJ 407', carrier: 'Royal Jordanian', from: 'AMM', to: 'BEY',
      date: '2026-11-14', depart: '05:00', arrive: '05:05', duration: '1h 05m',
      aircraft: 'Embraer E195-E2', layout: 'e195', fare: 118000, open: .29,
      schedule: 'https://www.flightstats.com/v2/flight-tracker/RJ/407?date=14&flightId=1419798698&month=11&year=2026' },
    { id: 'tk815', number: 'TK 815', carrier: 'Turkish Airlines', from: 'AMM', to: 'IST',
      date: '2026-11-15', depart: '06:15', arrive: '08:55', duration: '2h 40m',
      aircraft: 'Airbus A321neo', layout: 'a321', fare: 189000, open: .33,
      schedule: 'https://www.flightstats.com/v2/flight-tracker/TK/815?date=15&flightId=1419994771&month=11&year=2026' },
    { id: 'ek904', number: 'EK 904', carrier: 'Emirates', from: 'AMM', to: 'DXB',
      date: '2026-11-16', depart: '18:45', arrive: '22:40', duration: '2h 55m',
      aircraft: 'Airbus A380-800', layout: 'a380', fare: 225000, open: .26,
      schedule: 'https://www.flightstats.com/v2/flight-tracker/EK/904?date=16&flightId=1420137743&month=11&year=2026' },
    { id: 'ek660', number: 'EK 660', carrier: 'Emirates', from: 'DXB', to: 'MLE',
      date: '2026-11-16', depart: '10:15', arrive: '15:30', duration: '4h 15m',
      aircraft: 'Boeing 777-300ER', layout: 'b777', fare: 364000, open: .38,
      schedule: 'https://www.flight.info/EK660' },
    { id: 'qr944', number: 'QR 944', carrier: 'Qatar Airways', from: 'DOH', to: 'SIN',
      date: '2026-11-16', depart: '08:25', arrive: '21:15', duration: '7h 50m',
      aircraft: 'Airbus A350-900', layout: 'a350', fare: 435000, open: .22,
      schedule: 'https://www.flight.info/QR944' },
    { id: 'rj261', number: 'RJ 261', carrier: 'Royal Jordanian', from: 'AMM', to: 'JFK',
      date: '2026-11-17', depart: '12:15', arrive: '16:15', duration: '12h 00m',
      aircraft: 'Boeing 787-8 Dreamliner', layout: 'b787', fare: 489000, open: .31,
      schedule: 'https://www.flightstats.com/v2/flight-tracker/RJ/261?date=17&flightId=1420340473&month=11&year=2026' }
  ].map(flight => ({
    ...flight, photo: 'assets/photos/' + photoFiles[flight.id][0] + '.webp',
    photoCredit: 'https://commons.wikimedia.org/wiki/File:' + photoFiles[flight.id][1]
  }));

  function seatRows(flight) {
    const layout = layouts[flight.layout];
    return layout.decks.map(item => ({
      ...item,
      rows: item.rows.map(row => ({
        ...row, seats: row.groups.flatMap((block, blockIndex) => [...block].filter(letter => letter !== '-').map(letter => ({
          id: String(row.number) + letter, letter, row: row.number, deck: item.id, cabin: row.cabin,
          block: blockIndex, exit: row.exit, rearFacing: row.rearFacing
        })))
      }))
    }));
  }

  const classFactor = Object.freeze({ Economy: 1, 'Premium Economy': 1.38, Business: 2.3, Crown: 2.3, Qsuite: 2.55, First: 3.4 });
  const isVip = cabin => ['First', 'Business', 'Crown', 'Qsuite'].includes(cabin);
  const seatFare = (flight, seat) => Math.round(flight.fare * classFactor[seat.cabin] + (seat.exit ? 12000 : 0));
  const money = fils => 'JOD ' + (fils / 1000).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const displayDate = date => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric',
    timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  global.HackAirport = { flights, layouts, airports, seatRows, seatFare, isVip, money, displayDate };
})(globalThis);
