(function () {
  'use strict';

  const { flights, money, airports, seatRows } = HackAirport;
  const lab = HackAirportSecurity;
  const { api, identities } = lab;
  const kind = document.body.dataset.lab;
  const el = id => document.getElementById(id);
  const url = new URL(location.href);
  const flight = flights.find(item => item.id === url.searchParams.get('flight')) || flights[0];
  const ownBooking = 'HA-1042';
  const currentBooking = url.searchParams.get('ticket') ?? ownBooking;
  const wantsAdmin = url.searchParams.get('view') === 'admin';
  const statusNames = { 200: 'OK', 403: 'Forbidden', 404: 'Not found', 405: 'Method not allowed',
    409: 'Conflict', 422: 'Invalid input' };
  const lineMarkers = {
    idor: ['return ticketResponse', 'ticket.ownerId !== actor.id'],
    admin: ['model.priceFils = request.body.priceFils', "actor.role !== 'operator'"],
    coupon: ['cart.totalFils = Math.round(cart.totalFils', 'cart.appliedCodes.includes(code)']
  };

  el('portal-flight').textContent = flight.number + ' · ' + airports[flight.from].city + ' → ' + airports[flight.to].city;
  const photo = new URL(flight.photo, document.baseURI);
  document.querySelector('.lab-portal-banner').style.setProperty('--lab-still', 'url("' + photo.href + '")');
  const returnLink = document.querySelector('[data-return]');
  returnLink.href = 'flight.html?flight=' + encodeURIComponent(flight.id) + '#security-labs';
  returnLink.textContent = 'Back to flight labs';
  el('guided-flight').textContent = flight.number + ' · ' + airports[flight.from].city + ' → ' + airports[flight.to].city;
  const demoSeats = seatRows(flight).flatMap(deck => deck.rows)
    .filter(row => row.cabin === 'Economy').flatMap(row => row.seats).slice(0,3);
  let model;
  let fixed;
  let actor;
  let last;
  let savedAttack;
  let comparison;
  let adminOpen;
  let historyLog;
  const scenarioField = el('attack-options');
  let selectedScenarioId = '';
  const resultSite = document.querySelector('meta[name="result-site"]')?.content;
  const steps = [...document.querySelectorAll('.lab-steps li')];
  const scenarios = {
    idor: [
      { id:'noah', label:'Read Noah’s boarding pass', request:makeRequest('GET',api.ticket+'HA-1043'),
        context:'Ava is signed in. The request uses Noah’s booking reference.',
        success:'Noah’s boarding pass was returned to Ava.', blocked:404 },
      { id:'mira', label:'Read Mira’s boarding pass', request:makeRequest('GET',api.ticket+'HA-1044'),
        context:'Ava is signed in. The request uses Mira’s booking reference.',
        success:'Mira’s boarding pass was returned to Ava.', blocked:404 }
    ],
    admin: [
      { id:'update', label:'Set the economy fare to JOD 19', request:makeRequest('PATCH',api.admin,{priceFils:19000}),
        context:'Ava has a customer session. The request tries to update the fare.',
        success:'The customer changed the economy fare to JOD 19.', blocked:403 },
      { id:'read', label:'Open the operator fare endpoint', request:makeRequest('GET',api.admin),
        context:'The request reads the operator fare endpoint from Ava’s customer session.',
        success:'The customer opened the operator fare endpoint.', blocked:403 }
    ],
    coupon: [
      { id:'repeat', label:'Replay FIRST25', request:makeRequest('POST',api.coupon,{code:lab.promo}),
        context:'The setup applies FIRST25 once. The attack sends the same code again on that checkout.',
        success:'The same checkout accepted a second discount.', blocked:409 },
      { id:'variant', label:'Replay with lowercase and spaces', request:makeRequest('POST',api.coupon,{code:' first25 '}),
        context:'The setup applies FIRST25 once. The attack changes the spelling of the repeat request.',
        success:'The same checkout accepted a second discount after normalizing the code.', blocked:409 }
    ]
  }[kind];
  for (const scenario of scenarios) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary payload-button';
    button.dataset.scenario = scenario.id;
    button.textContent = scenario.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      selectedScenarioId = scenario.id;
      updateScenario();
      runScenario();
    });
    scenarioField.append(button);
  }

  function makeRequest(method, path, body = {}) {
    return { method, path, body };
  }

  function serialize(request) {
    const firstLine = request.method + ' ' + request.path;
    return Object.keys(request.body).length ? firstLine + '\n\n' + JSON.stringify(request.body, null, 2) : firstLine;
  }

  function parseCouponRequest(input) {
    if (input.length > 3000) throw new Error('Keep the request under 3000 characters.');
    const [first, ...lines] = input.trim().split(/\r?\n/);
    const route = /^(GET|POST|PATCH) (\/[A-Za-z0-9/_-]+)$/.exec(first.trim());
    if (!route) throw new Error('The first line must contain the method and a local route.');
    let body;
    try {
      body = JSON.parse(lines.join('\n'));
    } catch {
      throw new Error('Enter a valid JSON body after the request line.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('The JSON body must be an object.');
    }
    return makeRequest(route[1], route[2], body);
  }

  function showFeedback(id, message = '', error = false) {
    const field = el(id);
    field.textContent = message;
    field.dataset.error = String(error);
  }

  function updateModeUrl() {
    const next = new URL(location.href);
    if (fixed) next.searchParams.set('mode', 'fixed');
    else next.searchParams.delete('mode');
    if (new URLSearchParams(next.hash.slice(1)).has('demo')) next.hash='';
    // Browser rules for file URLs can restrict changes to the address bar.
    try { history.replaceState(null, '', next.href); } catch {}
  }

  function log(request, response, raw) {
    last = { request, response, raw, identity: actor };
    historyLog.unshift(last);
    historyLog.length = Math.min(historyLog.length, 10);
  }

  function run(request, raw = serialize(request), scenario = null) {
    const checkpoint = fixed ? null : structuredClone(model);
    const response = lab.dispatch(kind, model, request, actor, fixed);
    if (!fixed && lab.exploited(kind, checkpoint, response, actor)) {
      savedAttack = { checkpoint, request, raw, actor, before: response, scenario, vulnerableState: structuredClone(model) };
    }
    if (kind === 'admin') adminOpen = response.status === 200 || (adminOpen && response.status === 422);
    log(request, response, raw);
    render();
    return response;
  }

  function applyFix() {
    if (fixed) return;
    fixed = true;
    setProgress(currentScenario() ? 4 : 1);
    updateModeUrl();
    if (savedAttack) {
      const { checkpoint, request, raw, actor: originalActor, before, scenario, vulnerableState } = savedAttack;
      model = structuredClone(checkpoint);
      actor = originalActor;
      const after = lab.dispatch(kind, model, request, actor, true);
      if (kind === 'admin') adminOpen = after.status === 200;
      comparison = { raw, before, after, scenario, vulnerableState };
      log(request, after, raw);
      if (scenario && selectedScenarioId === scenario.id) showVerdict(scenario,after,checkpoint);
    }
    if (kind === 'coupon') showFeedback('coupon-feedback');
    render();
  }

  function reset(useDirectMode = false, savedResult = null) {
    model = lab.initial(flight, demoSeats);
    actor = identities.buyer;
    fixed = savedResult ? savedResult.fixed : useDirectMode && new URL(location.href).searchParams.get('mode') === 'fixed';
    last = savedAttack = comparison = null;
    adminOpen = false;
    historyLog = [];
    selectedScenarioId = '';
    updateScenario();
    if (!savedResult) updateModeUrl();
    if (kind === 'idor') {
      return run(makeRequest('GET', api.ticket + currentBooking));
    }
    if (kind === 'admin') {
      el('new-price').value = '';
      if (wantsAdmin) return run(makeRequest('GET', api.admin));
    }
    if (kind === 'coupon') {
      lab.openCart(model);
      el('promo-code').value = '';
      el('request-editor').value = '';
      showFeedback('coupon-feedback');
      showFeedback('request-error');
    }
    render();
  }

  function currentScenario() {
    return scenarios.find(candidate => candidate.id === selectedScenarioId);
  }

  function setProgress(step, complete = false) {
    steps.forEach((item,index) => {
      item.classList.toggle('is-done', index+1 < step || complete);
      if (index+1 === step && !complete) item.setAttribute('aria-current','step');
      else item.removeAttribute('aria-current');
    });
  }

  function updateScenario() {
    const scenario = currentScenario();
    for (const button of scenarioField.querySelectorAll('.payload-button')) {
      const selected = button.dataset.scenario === selectedScenarioId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    el('attack-code').textContent = scenario ? serialize(scenario.request) : 'Press a payload button to see its request.';
    el('attack-context').textContent = scenario?.context || 'Press a payload button to run a request and see its effect.';
    el('attack-result').hidden = true;
    el('attack-effects').hidden = true;
    el('result-share').hidden = true;
    el('copy-status').textContent = '';
    if (comparison?.scenario && comparison.scenario.id !== scenario?.id) comparison = null;
    el('comparison').hidden = !comparison;
    setProgress(scenario ? fixed ? 4 : 2 : 1);
  }

  function effectState(scenario, data, reply = null) {
    if (kind==='idor') {
      if (!reply) {
        const own=data.tickets.find(ticket => ticket.ownerId===actor.id);
        return [actor.name, 'Signed in · Own pass '+own.id];
      }
      return reply.status===200 ?
        [reply.body.passenger, 'Pass '+reply.body.bookingId+' · Seat '+reply.body.seat+' shared with '+actor.name] :
        ['No boarding pass shared', 'The other passenger’s details stayed private.'];
    }
    if (kind==='admin') {
      if (scenario.id==='update') return [money(data.priceFils), reply?.status===403 ? 'Fare protected · customer denied' : 'Economy fare'];
      return reply?.status===200 ?
        ['Operator fares opened', money(reply.body.priceFils)+' shown to a customer'] :
        ['Customer access only', reply?.status===403 ? 'Operator fare access denied' : 'Operator fare is restricted'];
    }
    const applied=data.cart.appliedCodes.length;
    return [money(data.cart.totalFils), applied+' '+(applied===1?'discount':'discounts')+' applied to this checkout'];
  }

  function renderEffects(scenario, response, checkpoint) {
    const pair = fixed && comparison?.scenario?.id===scenario.id ? comparison : null;
    const before = pair ? effectState(scenario,pair.vulnerableState,pair.before) : effectState(scenario,checkpoint);
    const after = effectState(scenario,model,response);
    el('effect-before-label').textContent = pair ? 'Before the fix' : 'Before the request';
    el('effect-after-label').textContent = pair ? 'After the fix' : 'After the request';
    el('effect-before-value').textContent = before[0];
    el('effect-before-detail').textContent = before[1];
    el('effect-after-value').textContent = after[0];
    el('effect-after-detail').textContent = after[1];
    el('attack-effects').dataset.outcome = fixed ? 'blocked' : 'exploited';
    el('attack-effects').hidden = false;
  }

  function resultLink(scenario) {
    const local = new URL(location.href);
    local.search = '';
    local.searchParams.set('flight',flight.id);
    local.hash = new URLSearchParams({demo:scenario.id,state:fixed?'blocked':'exploited'}).toString();
    if (local.protocol==='file:' && resultSite) {
      return new URL(local.pathname.split('/').at(-1)+local.search+local.hash,resultSite).href;
    }
    return local.href;
  }

  function renderResultLink(scenario) {
    const href = resultLink(scenario);
    const online = new URL(href).protocol!=='file:';
    el('result-url').value = href;
    el('open-result').href = href;
    el('result-link-note').textContent = online ?
      'Opens this scenario and result directly. Site access still applies.' :
      'Opens this result from the extracted project on this device.';
    el('copy-status').textContent = '';
    el('result-share').hidden = false;
  }

  function showVerdict(scenario, response, checkpoint) {
    const outcome = fixed ? 'blocked' : 'exploited';
    const expected = fixed ? scenario.blocked : 200;
    const okay = response.status===expected;
    const result = el('attack-result');
    result.dataset.outcome = okay ? outcome : 'unexpected';
    el('attack-verdict').textContent = okay ? (fixed?'Blocked':'Exploited') : 'Unexpected response';
    const reason = fixed || !okay ? response.body.message || 'Review the response below.' : scenario.success;
    el('attack-message').textContent = response.status+' '+statusNames[response.status]+' · '+reason;
    result.hidden = false;
    if (okay) {
      renderEffects(scenario,response,checkpoint);
      renderResultLink(scenario);
    }
  }

  function runScenario() {
    const scenario = currentScenario();
    if (!scenario) return;
    // Rebuild the same prerequisites on every run, including the first valid discount.
    model = lab.initial(flight,demoSeats);
    actor = identities.buyer;
    adminOpen = false;
    if (kind === 'coupon') {
      lab.openCart(model);
      showFeedback('coupon-feedback');
      const setup = makeRequest('POST',api.coupon,{code:lab.promo});
      log(setup,lab.dispatch(kind,model,setup,actor,true),serialize(setup));
    }
    const checkpoint = structuredClone(model);
    const request = scenario.request;
    const raw = serialize(request);
    if (fixed) {
      const vulnerableState = structuredClone(checkpoint);
      const before = lab.dispatch(kind,vulnerableState,request,actor,false);
      comparison = { raw,before,after:null,scenario,vulnerableState };
    }
    const response = run(request,raw,scenario);
    if (fixed) {
      comparison.after = response;
      renderComparison();
    }
    showVerdict(scenario,response,checkpoint);
    setProgress(fixed?4:3,fixed && response.status===scenario.blocked);
  }

  async function copyResultLink() {
    const field = el('result-url');
    try {
      await navigator.clipboard.writeText(field.value);
      el('copy-status').textContent = 'Result link copied.';
    } catch {
      field.focus();
      field.select();
      el('copy-status').textContent = 'Link selected. Use Ctrl+C or Command+C to copy it.';
    }
  }

  function openLinkedResult() {
    const params = new URLSearchParams(location.hash.slice(1));
    const scenario = scenarios.find(item=>item.id===params.get('demo'));
    const resultState = params.get('state');
    if (!scenario || !['blocked','exploited'].includes(resultState)) return false;
    reset(true,{fixed:resultState==='blocked'});
    selectedScenarioId = scenario.id;
    updateScenario();
    runScenario();
    return true;
  }

  function receipt(title, entries) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    const list = document.createElement('dl');
    for (const [label, value] of entries) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      row.append(term, detail);
      list.append(row);
    }
    el('app-output').replaceChildren(heading, list);
  }

  function renderPortal() {
    const status = last?.response.status;
    const data = last?.response.body;
    if (kind === 'idor') {
      if (status === 200) {
        receipt('Confirmed boarding pass', [['Booking', data.bookingId], ['Passenger', data.passenger],
          ['Seat', data.seat], ['Paid', money(data.paidFils)]]);
      } else {
        receipt(data?.message || 'Boarding pass', []);
      }
    }
    if (kind === 'admin') {
      receipt(adminOpen ? 'Fare operations' : 'Published demo fare', [
        ['Economy fare', money(model.priceFils)],
        ['Console', adminOpen ? 'Open' : status === 403 ? 'Access denied' : 'Customer view']
      ]);
      el('price-form').hidden = !adminOpen;
      el('identity-tools').hidden = !fixed || !wantsAdmin;
      el('demo-role').value = actor === identities.operator ? 'operator' : 'buyer';
    }
    if (kind === 'coupon') {
      const cart = model.cart;
      receipt(lab.cartId, [['Subtotal', money(cart.subtotalFils)], ['Applied', cart.appliedCodes.length],
        ['Savings', money(cart.subtotalFils - cart.totalFils)], ['Total', money(cart.totalFils)]]);
    }
  }

  function renderResponse(prefix, response) {
    el(prefix + '-status').textContent = response.status + ' ' + statusNames[response.status];
    el(prefix + '-status').dataset.error = String(response.status >= 400);
    el(prefix === 'response' ? 'response' : prefix + '-response').textContent =
      JSON.stringify(response.body, null, 2);
  }

  function render() {
    el('actor').textContent = actor.name + ' · ' + actor.role;
    el('mode-state').textContent = fixed ? 'Fixed mode' : 'Vulnerable mode';
    el('mode-state').classList.toggle('is-fixed', fixed);
    document.querySelectorAll('[data-mode-select]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.modeSelect === (fixed ? 'fixed' : 'vulnerable')));
    });
    const active = el('active-code');
    const mode = fixed ? 'fixed' : 'vulnerable';
    if (active.dataset.mode !== mode) {
      active.dataset.mode = mode;
      active.replaceChildren();
      el('active-code-title').textContent = 'Active handler · '+(fixed?'Fixed':'Vulnerable');
      showCode('active-code',lab.snippets[kind][Number(fixed)],lineMarkers[kind][Number(fixed)]);
    }
    renderPortal();
    if (last) {
      el('request-line').textContent = last.raw;
      renderResponse('response', last.response);
    } else {
      el('request-line').textContent = 'No request sent.';
      el('response-status').textContent = '';
      el('response').textContent = 'No request sent.';
    }
    el('request-history').replaceChildren(...historyLog.map(entry => {
      const item = document.createElement('li');
      item.textContent = entry.request.method + ' ' + entry.request.path + ' · ' +
        entry.response.status + ' · ' + entry.identity.role;
      return item;
    }));
    renderComparison();
  }

  function renderComparison() {
    el('comparison').hidden = !comparison?.after;
    if (comparison?.after) {
      el('compare-request').textContent = comparison.raw;
      renderResponse('before', comparison.before);
      renderResponse('after', comparison.after);
    }
  }

  function showCode(id, fn, marker) {
    fn.toString().split('\n').forEach((line, index) => {
      const row = document.createElement('span');
      row.className = 'code-line';
      if (line.includes(marker)) row.classList.add('highlight-line');
      const number = document.createElement('strong');
      number.setAttribute('aria-hidden', 'true');
      number.textContent = index + 1;
      row.append(number, index ? line.slice(2) : line);
      el(id).append(row);
    });
  }

  el('coupon-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const response = run(makeRequest('POST', api.coupon, { code: el('promo-code').value }));
    showFeedback('coupon-feedback', response.status === 200 ? 'Promotion applied.' : response.body.message,
      response.status !== 200);
  });
  el('request-editor')?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.repeat || event.isComposing) return;
    event.preventDefault();
    const raw = event.currentTarget.value;
    try {
      const request = parseCouponRequest(raw);
      showFeedback('request-error');
      showFeedback('coupon-feedback');
      run(request, raw);
    } catch (error) {
      showFeedback('request-error', error.message, true);
    }
  });
  el('price-form')?.addEventListener('submit', event => {
    event.preventDefault();
    if (!adminOpen) return;
    const priceFils = Math.round(el('new-price').valueAsNumber * 1000);
    run(makeRequest('PATCH', api.admin, { priceFils }));
  });
  el('demo-role')?.addEventListener('change', event => {
    if (!fixed || !wantsAdmin) return;
    actor = identities[event.currentTarget.value] || identities.buyer;
    run(makeRequest('GET', api.admin));
  });
  document.querySelectorAll('[data-mode-select]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.modeSelect === 'fixed') {
        applyFix();
      } else if (fixed) {
        reset();
      }
    });
  });
  el('reset').addEventListener('click', () => reset());

  el('copy-result').addEventListener('click',copyResultLink);
  addEventListener('hashchange',openLinkedResult);
  if (!openLinkedResult()) reset(true);
})();
