(function (airport) {
  'use strict';

  const add = (a, b) => a.map((n, i) => n + b[i]);
  const sub = (a, b) => a.map((n, i) => n - b[i]);
  const times = (a, factor) => a.map(n => n * factor);
  const dot = (a, b) => a.reduce((n, value, i) => n + value * b[i], 0);
  const cross = ([x, y, z], [a, b, c]) => [y*c-z*b, z*a-x*c, x*b-y*a];
  const unit = a => times(a, 1 / (Math.hypot(...a) || 1));
  const blend = (a, b, ratio) => a.map((value, i) => value + (b[i] - value) * ratio);
  const near = .37;
  const economical = cabin => cabin === 'Economy' || cabin === 'Premium Economy';
  const suites = row => row.cabin === 'First' || row.cabin === 'Qsuite' ||
    (row.cabin === 'Business' && row.full.length === 3);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const colorCache = new Map();

  function shade(hex, amount) {
    const key = hex + amount;
    if (colorCache.has(key)) return colorCache.get(key);
    const number = parseInt(hex.slice(1), 16);
    const rgb = [number >> 16, (number >> 8) & 255, number & 255];
    const color = 'rgb(' + rgb.map(n => Math.round(Math.min(255, n * amount))).join(',') + ')';
    colorCache.set(key, color);
    return color;
  }

  function rowSpacing(row) {
    if (row.cabin === 'First') return 1.57;
    if (suites(row)) return 1.12;
    if (row.cabin === 'Business' || row.cabin === 'Crown') return 1.05;
    if (row.cabin === 'Premium Economy') return .93;
    return .79;
  }

  function rowPositions(rows, width) {
    let z = 0;
    return rows.map((row, index) => {
      const prev = rows[index - 1];
      if (prev) z += (rowSpacing(prev) + rowSpacing(row)) / 2 +
        (prev.cabin !== row.cabin ? 1.18 : row.exit && !prev.exit ? .72 : 0);
      const aisle = width < 3 ? .48 : .54;
      const innerWidth = width - .36 - (row.full.length - 1) * aisle;
      const blockWeight = suites(row) ? row.full.map((_, i) => i === 1 ? 2 : 1) :
        row.full.map(letters => letters.length);
      const weight = blockWeight.reduce((a, b) => a + b, 0);
      let position = -(width - .36) / 2;
      const seats = [];
      const aisles = [];
      row.full.forEach((letters, index) => {
        const blockWidth = innerWidth * blockWeight[index] / weight;
        const used = row.seats.filter(seat => seat.block === index);
        used.forEach(seat => {
          const column = letters.indexOf(seat.letter);
          const fraction = suites(row) ? (letters.length === 4 ? [.19,.34,.66,.81][column] :
            letters.length === 2 && index !== 1 ? [.37,.63][column] :
            (column + .5) / letters.length) : (column+.5)/letters.length;
          const pitch = suites(row) ? Math.min(.78, blockWidth * (index===1 ? .36 : .63)) : blockWidth / letters.length;
          seats.push({ ...seat, x: position + blockWidth * fraction, z, pitch });
        });
        if (index < row.full.length-1) aisles.push(position+blockWidth+aisle/2);
        position += blockWidth + aisle;
      });
      return { row, z, seats, aisles };
    });
  }

  function box(center, size, color, { lean = 0, style = '' } = {}) {
    const [x, y, z] = center;
    const [width, height, depth] = size;
    const w = width/2, h = height/2, d = depth/2;
    const at = (i, j, k) => [x+w*i, y+h*j, z+d*k+lean*j];
    const f = [
      [[at(-1,-1,-1),at(1,-1,-1),at(1,1,-1),at(-1,1,-1)], .94],
      [[at(1,-1,1),at(-1,-1,1),at(-1,1,1),at(1,1,1)], .79],
      [[at(-1,-1,1),at(-1,-1,-1),at(-1,1,-1),at(-1,1,1)], .83],
      [[at(1,-1,-1),at(1,-1,1),at(1,1,1),at(1,1,-1)], .90],
      [[at(-1,1,-1),at(1,1,-1),at(1,1,1),at(-1,1,1)], 1.13]
    ];
    return f.map(([points, tone]) => ({ points, color: shade(color, tone), style }));
  }

  function face(points, color, style = '') {
    return { points, color, style };
  }

  function upholsteredBack([x,y,z], width, height, color, direction) {
    const w = width / 2, h = height / 2;
    const corner = Math.min(.07, w * .24);
    const profile = [[-w+corner,-h],[w-corner,-h],[w,-h+corner],
      [w*.91,h-corner],[w*.91-corner,h],[-w*.91+corner,h],[-w*.91,h-corner],[-w,-h+corner]];
    const layer = sign => profile.map(([dx,dy]) => [x+dx,y+dy,z+(dy*.17 + sign*.063)*direction]);
    const front = layer(-1), back = layer(1);
    const faces = [face(front, shade(color,1.04), 'fabric'), face(back, shade(color,.82), 'fabric')];
    for (let i=0;i<profile.length;i++) {
      const j = (i+1) % profile.length;
      const tone = i===4 ? 1.22 : i<3 ? .98 : 1.1;
      faces.push(face([front[i],front[j],back[j],back[i]],shade(color,tone)));
    }
    return faces;
  }

  function seatMesh(seat, row, layout, state, detail) {
    const [x, z] = [seat.x, seat.z];
    const direction = row.rearFacing ? -1 : 1;
    const wide = !economical(row.cabin);
    const material = state === 'selected' ? '#c57848' : state === 'booked' ? '#607084' :
      wide || row.cabin === 'Premium Economy' ? layout.premium : layout.seat;
    const accent = state === 'selected' ? '#edb27d' : state === 'booked' ? '#8290a2' : airport.isVip(row.cabin) ? '#c6a473' : '#6d9caa';
    const width = Math.max(.32, seat.pitch * .89);
    const cushionDepth = wide ? .58 : .51;
    const high = wide ? .64 : .56;
    const leaned = (wide ? .077 : .051)*direction;
    const back = (wide ? .235 : .20)*direction;
    const mesh = [
      ...box([x,.40,z], [width,.16,cushionDepth], material),
      ...upholsteredBack([x,.69+high/7,z+back],width*.96,high,material,direction),
      ...upholsteredBack([x,.98+high/9,z+back+leaned],width*.86,.135,accent,direction)
    ];
    if (detail) {
      mesh.push(...box([x,.20,z], [width*.62,.25,.30], '#434858'));
      mesh.push(...box([x,.488,z-.075*direction], [width*.53,.015,.045], '#343643'));
      mesh.push(...box([x+.025,.50,z-.075*direction], [.071,.02,.052], '#9fa2ad'));
      for (const side of [-1, 1]) {
        mesh.push(...box([x+side*width*.48,.57,z-.038*direction], [.048,.061,cushionDepth*.72], '#3f4657'));
      }
      const screenZ = z + back + direction*.086;
      mesh.push(...box([x,.77,screenZ], [width*.66,.212,.025], '#171e2b', {lean: leaned*.29}));
      mesh.push(...box([x,.771,screenZ+direction*.016], [width*.55,.158,.008], '#38516c', {lean: leaned*.22}));
    }
    if (suites(row)) {
      const side = x > 0 ? -1 : 1;
      mesh.push(...box([x+side*(width*.66),.39,z], [width*.30,.74,.68], '#b2a292'));
      const outer = x-side*(width*.48);
      const shell = row.cabin === 'First' ? '#c6ad91' : '#9f8e84';
      mesh.push(...box([outer,.53,z+.045*direction],[.046,.74,.59],shell));
      if (row.cabin === 'First') mesh.push(...box([x,.53,z+.37*direction],[width,.74,.049],shell));
    }
    return mesh;
  }

  function modelRoom(layout, width, segment, mode, isFront = true) {
    const left = -width/2, right = width/2;
    const back = segment.at(-1).z + .7;
    const front = segment[0].z - .8;
    const cabinClosed = mode === 'aisle' || mode === 'seat';
    const mesh = [];
    for (let start = front; start < back; start += .79) {
      const end = Math.min(start+.792, back);
      mesh.push(face([[left,0,start],[right,0,start],[right,0,end],[left,0,end]], layout.floor));
      const nearest = segment.reduce((best,item) =>
        Math.abs(item.z-start) < Math.abs(best.z-start) ? item : best, segment[0]);
      const aisles = nearest.aisles;
      for (const x of aisles) {
        mesh.push(face([[x-.22,.007,start],[x+.22,.007,start],[x+.22,.007,end],[x-.22,.007,end]], shade(layout.floor, 1.28)));
      }
      for (const side of (cabinClosed ? [-1, 1] : [-1])) {
        const x = side < 0 ? left : right;
        mesh.push(face([[x,.0,start],[x,.0,end],[x,1.93,end],[x,1.93,start]], layout.wall));
        mesh.push(face([[x,.02,start],[x,.02,end],[x,.24,end],[x,.24,start]], shade(layout.wall,.72)));
        const shellX = x-side*(width < 4 ? .39 : .53);
        mesh.push(face([[x,1.92,start],[x,1.92,end],[shellX,2.19,end],[shellX,2.19,start]], shade(layout.wall,.91)));
        mesh.push(face([[shellX,1.87,start],[shellX,1.87,end],[shellX,2.19,end],[shellX,2.19,start]], shade(layout.wall,1.12)));
        if (cabinClosed) {
          const ceilingX = x*.70;
          mesh.push(face([[shellX,2.19,start],[shellX,2.19,end],[ceilingX,2.35,end],[ceilingX,2.35,start]], shade(layout.wall,1.09)));
          const led = shellX-side*.06;
          mesh.push(face([[led,2.22,start],[led,2.22,end],[led-side*.063,2.245,end],[led-side*.063,2.245,start]], '#d9eff8'));
        }
        const lightX = x - side*.16;
        mesh.push(face([[lightX,1.908,start],[lightX,1.908,end],[lightX-side*.085,1.965,end],[lightX-side*.085,1.965,start]], '#a3d7ee'));
        const mid = (start+end)/2;
        const pane = layout.window === 'dreamliner' ? [ .187, .283 ] : layout.window === 'wide' ? [.181,.242] : [.145,.226];
        for (const [grow, color, inset, style] of [[.041,'#acb4c0',.009,''], [.022,'#4c6d87',.030,''],[0,'#baddf2',.049,'window']]) {
          const points = Array.from({length:16},(_,i)=>{
            const angle = i*Math.PI/8;
            return [x-side*inset,1.19 + (pane[1]+grow)*Math.sin(angle),mid+(pane[0]+grow)*Math.cos(angle)];
          });
          mesh.push(face(points, color, style));
        }
      }
      if (cabinClosed) {
        mesh.push(face([[left*.70,2.35,start],[right*.70,2.35,start],[right*.70,2.35,end],[left*.70,2.35,end]], shade(layout.wall,1.07)));
        mesh.push(face([[-.14,2.346,start],[.14,2.346,start],[.14,2.346,end],[-.14,2.346,end]], '#edf0ef'));
      }
    }
    for (const point of segment.filter(item => item.row.exit)) {
      const z = point.z - .37;
      for (const side of (cabinClosed ? [-1,1] : [-1])) {
        const x = side < 0 ? left+.065 : right-.065;
        mesh.push(face([[x,.04,z-.28],[x,.04,z+.28],[x,1.89,z+.28],[x,1.89,z-.28]], layout.doors));
        mesh.push(face([[x-side*.045,1.04,z-.06],[x-side*.045,1.04,z+.06],[x-side*.045,1.10,z+.06],[x-side*.045,1.10,z-.06]], '#dde6f1'));
      }
    }
    if (cabinClosed) {
      const joint = isFront ? '#a5afbf' : '#a8b5c1';
      mesh.push(face([[left,0,front],[right,0,front],[right,2.35,front],[left,2.35,front]], joint));
      mesh.push(...box([0,.96,front+.014],[.66,1.91,.028], '#687e93'));
      mesh.push(...box([0,1.62,front+.038],[.19,.24,.018], '#273d54'));
      mesh.push(...box([.23,1.07,front+.045],[.10,.026,.019], '#d7dee8'));
      for (const side of [-1,1]) {
        const unitX = side*width*.32;
        mesh.push(...box([unitX,.70,front+.14],[.46,1.38,.23], '#d4dae1'));
        mesh.push(...box([unitX,1.63,front+.11],[.53,.44,.20], '#e1ded8'));
        mesh.push(...box([unitX,.94,front+.274],[.31,.037,.017], '#60788f'));
        mesh.push(...box([unitX,1.47,front+.23],[.26,.026,.018], '#798da0'));
      }
    }
    return mesh;
  }

  class Cabin {
    constructor(canvas, layer, onSelect) {
      this.canvas = canvas;
      this.layer = layer;
      this.onSelect = onSelect;
      this.ctx = canvas.getContext('2d');
      this.buttons = new Map();
      this.size = {width:0,height:0};
      this.raf = 0;
      this.resize = this.resize.bind(this);
      if (globalThis.ResizeObserver) new ResizeObserver(this.resize).observe(canvas);
      else addEventListener('resize', this.resize);
    }

    resize() {
      const { width, height } = this.canvas.getBoundingClientRect();
      if (!width || !height || !this.ctx) return;
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 1.65);
      this.canvas.width = Math.round(width*ratio);
      this.canvas.height = Math.round(height*ratio);
      this.ctx.setTransform(ratio,0,0,ratio,0,0);
      this.size = {width,height};
      this.draw();
    }

    setRows(deck, rows, layout, status) {
      this.layout = layout;
      this.width = deck.width || layout.width;
      const full = rowPositions(deck.rows,this.width);
      const start = deck.rows.indexOf(rows[0]);
      const offset = full[start].z;
      const relative = item => ({...item,z:item.z-offset,seats:item.seats.map(seat=>({...seat,z:seat.z-offset}))});
      this.segment = full.slice(start,start+rows.length).map(relative);
      this.context = full.slice(Math.max(0,start-5),start+rows.length+3).map(relative);
      this.frontVisible = start<=5;
      this.seats = this.segment.flatMap(item => item.seats.map(seat=>({seat,row:item.row})));
      this.status = status;
      this.buttons.clear();
      this.layer.replaceChildren();
      for (const {seat} of this.seats) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hot-seat';
        button.dataset.seat = seat.id;
        button.addEventListener('click', () => this.onSelect(seat));
        this.buttons.set(seat.id, button);
        this.layer.append(button);
      }
      this.setCamera('overview', null, false);
      this.update();
      this.resize();
    }

    update() {
      for (const {seat} of this.seats) {
        const button = this.buttons.get(seat.id);
        const state = this.status(seat);
        button.disabled = state === 'booked';
        button.className = 'hot-seat ' + state + (airport.isVip(seat.cabin) ? ' vip-seat' : '');
        button.setAttribute('aria-label', 'Seat '+seat.id+', '+seat.cabin+(airport.isVip(seat.cabin)?' VIP':'')+', '+state);
        button.setAttribute('aria-pressed', String(state === 'selected'));
      }
      this.makeGeometry();
      this.draw();
    }

    makeGeometry() {
      if (!this.segment) return;
      const detailed = this.mode !== 'overview';
      const inCabin = this.mode==='aisle' || this.mode==='seat';
      const scene = inCabin ? this.context : this.segment;
      this.geometry = modelRoom(this.layout,this.width,scene,this.mode,this.frontVisible);
      for (const {seats,row} of scene) {
        for (const seat of seats) {
          this.geometry.push(...seatMesh(seat, row, this.layout, this.status(seat), detailed));
        }
      }
    }

    setCamera(mode, selection, animate = true) {
      if (!this.segment) return;
      this.mode = mode;
      this.selected = this.seats.find(item => item.seat.id === selection)?.seat;
      const end = this.segment.at(-1).z;
      const center = end/2;
      const broad = this.width;
      const width = this.size.width || this.canvas.getBoundingClientRect().width;
      const compact = width > 0 && width < 550;
      let camera = { eye:[broad*.68,Math.max(6.6,end*.68+3.7)+(compact?1.1:0),end+Math.max(4.2,broad*.76)],
        target:[0,.25,center], lens:compact?1.04:1.29 };
      if (mode === 'aisle') {
        const aisle = this.segment.at(-1).aisles[0] || 0;
        camera = {eye:[aisle,1.63,end+.63],target:[aisle,1.30,Math.max(0,end-7)],lens:1.04};
      }
      if (this.selected && mode === 'focus') {
        const {x,z} = this.selected;
        camera = {eye:[x*.66+broad*.42,3.35,z+3.3],target:[x,.56,z],lens:1.1};
      }
      if (this.selected && mode === 'seat') {
        const {x,z,rearFacing} = this.selected;
        const direction = rearFacing ? 1 : -1;
        const windowSeat = Math.abs(x)>broad*.32;
        const gaze = windowSeat ? Math.sign(x)*broad*.49 : x*.90;
        camera = {eye:[x,1.39,z-.06*direction],target:[gaze,1.23,z+direction*(windowSeat?1.15:2.65)],lens:.91};
      }
      cancelAnimationFrame(this.raf);
      this.makeGeometry();
      if (!animate || !this.camera || reducedMotion) {
        this.camera = camera;
        this.draw();
        return;
      }
      const start = performance.now();
      const from = this.camera;
      const frame = now => {
        const t = 1-Math.pow(1-Math.min(1,(now-start)/490),3);
        this.camera = {eye:blend(from.eye,camera.eye,t),target:blend(from.target,camera.target,t),lens:from.lens+(camera.lens-from.lens)*t};
        this.draw();
        if (t < 1) this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    }

    draw() {
      if (!this.ctx || !this.camera || !this.size.width || !this.geometry) return;
      const { width, height } = this.size;
      const { eye, target, lens } = this.camera;
      const ctx = this.ctx;
      const forward = unit(sub(target,eye)), right = unit(cross(forward,[0,1,0])), up = cross(right,forward);
      const focal = Math.min(width*.96,height) * lens;
      const convert = point => {
        const relative = sub(point,eye);
        return [dot(relative,right),dot(relative,up),dot(relative,forward)];
      };
      const project = ([x,y,d]) => [width/2+x*focal/d,height*.512-y*focal/d,d];
      const bg = ctx.createLinearGradient(0,0,width*.55,height);
      bg.addColorStop(0,'#1c3652'); bg.addColorStop(.6,'#111e34'); bg.addColorStop(1,'#142239');
      ctx.fillStyle = bg;
      ctx.fillRect(0,0,width,height);
      const shapes = [];
      for (const item of this.geometry) {
        const points = item.points.map(convert);
        if (points.every(point=>point[2]<near)) continue;
        let clipped = points;
        if (points.some(point=>point[2]<near)) {
          clipped = [];
          let prev = points.at(-1);
          for (const point of points) {
            if ((prev[2]>=near) !== (point[2]>=near)) clipped.push(blend(prev,point,(near-prev[2])/(point[2]-prev[2])));
            if (point[2]>=near) clipped.push(point);
            prev = point;
          }
        }
        if (clipped.length < 3) continue;
        const screen = clipped.map(project);
        if (screen.every(p=>p[0]<0)||screen.every(p=>p[0]>width)||
          screen.every(p=>p[1]<0)||screen.every(p=>p[1]>height)) continue;
        const depth = clipped.reduce((sum,point)=>sum+point[2],0)/clipped.length;
        shapes.push({ screen, depth, color:item.color, style:item.style });
      }

      shapes.sort((a,b)=>b.depth-a.depth);
      for (const {screen,color,style} of shapes) {
        ctx.beginPath();
        ctx.moveTo(screen[0][0],screen[0][1]);
        for (const [x,y] of screen.slice(1)) ctx.lineTo(x,y);
        ctx.closePath();
        ctx.fillStyle = color;
        if (style === 'fabric') {
          const top = Math.min(...screen.map(point=>point[1]));
          const bottom = Math.max(...screen.map(point=>point[1]));
          if (bottom-top > 4) {
            const surface = ctx.createLinearGradient(0,top,0,bottom);
            surface.addColorStop(0,color); surface.addColorStop(.72,color); surface.addColorStop(1,'#162138');
            ctx.fillStyle = surface;
          }
        }
        if (style === 'window') {
          const y = Math.min(...screen.map(point=>point[1]));
          const max = Math.max(...screen.map(point=>point[1]));
          if (max-y>1) {
            const glass = ctx.createLinearGradient(0,y,0,max);
            glass.addColorStop(0,'#7baed7'); glass.addColorStop(.57,'#cbe5f7'); glass.addColorStop(1,'#e6f3fa');
            ctx.fillStyle = glass;
          }
        }
        ctx.fill();
      }
      this.positionLabels(width,height,convert,project);
    }

    positionLabels(width,height,convert,project) {
      const overview = this.mode === 'overview';
      const focus = this.mode === 'focus';
      for (const {seat} of this.seats) {
        const button = this.buttons.get(seat.id);
        const point = convert([seat.x,.51,seat.z-.10]);
        const [x,y,d] = project(point);
        const inFocus = focus && this.selected && Math.abs(seat.z-this.selected.z)<2.1;
        button.hidden = (!overview && !inFocus) || d<near || x<10 || y<10 || x>width-10 || y>height-10;
        if (button.hidden) continue;
        button.style.left = x+'px';
        button.style.top = y+'px';
        button.textContent = width<560 || (overview && d>14) ? seat.letter : seat.id;
      }
    }
  }

  class FullDeck {
    constructor(root, deck, layout, status, select) {
      this.root = root;
      this.deck = deck;
      this.layout = layout;
      this.width = deck.width || layout.width;
      this.rows = rowPositions(deck.rows, this.width);
      this.status = status;
      this.buttons = [];
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.className = 'deck-canvas';
      this.ctx = this.canvas.getContext('2d');
      const layer = document.createElement('div');
      layer.className = 'deck-seat-layer';
      layer.setAttribute('role', 'group');
      layer.setAttribute('aria-label', 'Seats on ' + deck.name.toLowerCase());
      for (const {seats} of this.rows) {
        for (const seat of seats) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.seat = seat.id;
          button.textContent = seat.letter;
          button.addEventListener('click', () => select(seat));
          this.buttons.push({button,seat});
          layer.append(button);
        }
      }
      root.replaceChildren(this.canvas,layer);
      this.resize = this.resize.bind(this);
      if (globalThis.ResizeObserver) new ResizeObserver(this.resize).observe(root);
      else addEventListener('resize', this.resize);
      this.resize();
    }

    setFit(fit) {
      this.fit = fit;
      this.resize();
    }

    resize() {
      const width = this.root.clientWidth;
      if (!width || (width === this.size?.width && this.fit === this.size?.fit)) return;
      const end = this.rows.at(-1).z;
      const natural = Math.min(100,(width-76)/(this.width+.48));
      const scale = this.fit ? Math.min(natural,470/(end*.73+2.1)) : natural;
      const lengthScale = this.fit ? scale*.73 : Math.max(width<490 ? 39 : 52,scale*.73);
      const origin = this.fit ? Math.max(28,scale*.86) : width<490 ? 77 : 108;
      const height = Math.ceil(2*origin + this.rows.at(-1).z*lengthScale + 9);
      const density = Math.min(devicePixelRatio || 1,1.4);
      this.size = {width,height,scale,lengthScale,origin,fit:this.fit};
      this.root.style.height = height+'px';
      this.canvas.width = Math.round(width*density);
      this.canvas.height = Math.round(height*density);
      this.ctx?.setTransform(density,0,0,density,0,0);
      this.update();
    }

    projection(x,y,z) {
      const {width,scale,lengthScale,origin} = this.size;
      return [width*.5+(x+y*.115)*scale, origin+z*lengthScale-y*scale*.22];
    }

    update() {
      if (!this.size) return;
      const {width,scale} = this.size;
      for (const {button,seat} of this.buttons) {
        const state = this.status(seat);
        const vip = airport.isVip(seat.cabin);
        const [x,y] = this.projection(seat.x,.51,seat.z-.09);
        button.style.left = x+'px';
        button.style.top = y+'px';
        button.style.width = Math.max(15,Math.min(27,scale*.35))+'px';
        button.className = 'deck-seat ' + state + (vip ? ' vip-seat' : '');
        button.title = seat.id+' · '+seat.cabin + (vip ? ' VIP' : '');
        button.setAttribute('aria-label', 'Seat '+seat.id+', '+seat.cabin+(vip?' VIP':'')+', '+state);
        button.setAttribute('aria-pressed',String(state==='selected'));
        button.disabled = state==='booked';
        button.textContent = width<515 ? seat.letter : seat.id;
      }
      this.draw();
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      const {width,height,scale,origin,lengthScale} = this.size;
      const center = width/2;
      const half = this.width/2*scale;
      const left = center-half, right=center+half;
      const last = origin + this.rows.at(-1).z*lengthScale;
      const bottom = last + origin*.73;
      const top = this.fit ? 7 : 17;
      ctx.clearRect(0,0,width,height);

      const shell = ctx.createLinearGradient(left,0,right,0);
      shell.addColorStop(0,'#bdc8d5'); shell.addColorStop(.08,'#e7edf2');
      shell.addColorStop(.46,'#f5f6f1'); shell.addColorStop(.91,'#d7e0e9'); shell.addColorStop(1,'#a9b6c7');
      ctx.beginPath();
      ctx.moveTo(center,top);
      ctx.bezierCurveTo(center+half*.64,top,right,origin*.53,right,origin*.86);
      ctx.lineTo(right,last+lengthScale*.4);
      ctx.bezierCurveTo(right,bottom-12,center+half*.69,bottom,center,bottom);
      ctx.bezierCurveTo(center-half*.69,bottom,left,bottom-12,left,last+lengthScale*.4);
      ctx.lineTo(left,origin*.86);
      ctx.bezierCurveTo(left,origin*.53,center-half*.64,top,center,top);
      ctx.closePath();
      ctx.save();
      ctx.shadowColor='#12294742'; ctx.shadowBlur=13; ctx.shadowOffsetY=5;
      ctx.fillStyle=shell; ctx.fill();
      ctx.restore();
      ctx.strokeStyle='#a6b6c7'; ctx.lineWidth=1.6; ctx.stroke();
      ctx.save();
      ctx.clip();

      const bodyMargin = Math.max(this.fit ? 2 : 8, scale*.15);
      const floorTop = origin*.71;
      const floorBottom = last+Math.max(this.fit ? 4 : 18,lengthScale*.29);
      ctx.fillStyle=this.layout.floor;
      ctx.fillRect(left+bodyMargin,floorTop,half*2-bodyMargin*2,floorBottom-floorTop);
      const flooring = ctx.createLinearGradient(left+bodyMargin,0,right-bodyMargin,0);
      flooring.addColorStop(0,'#0b18286f'); flooring.addColorStop(.5,'#ffffff15'); flooring.addColorStop(1,'#0b182860');
      ctx.fillStyle=flooring;
      ctx.fillRect(left+bodyMargin,floorTop,half*2-bodyMargin*2,floorBottom-floorTop);

      for (const [index, item] of this.rows.entries()) {
        const {row,z,aisles}=item;
        const [,y]=this.projection(0,0,z);
        const [,nextY]=this.projection(0,0,this.rows[index+1]?.z ?? z+.49);
        const start=index===0?floorTop:y-lengthScale*.34;
        const finish=Math.min(floorBottom,nextY-lengthScale*.33);
        for(const aisle of aisles){
          const [x]=this.projection(aisle,0,z);
          ctx.fillStyle=airport.isVip(row.cabin)?'#b4977248':'#8396aa46';
          ctx.fillRect(x-scale*.23,start,scale*.46,Math.max(1,finish-start+2));
          ctx.fillStyle='#e5e7ee28';
          ctx.fillRect(x-scale*.18,start,1,Math.max(1,finish-start+2));
        }
        for(const x of [left+bodyMargin*.57,right-bodyMargin*.57]){
          ctx.beginPath();
          ctx.ellipse(x,y-scale*.05,Math.max(1,scale*.040),Math.max(1.5,scale*.075),0,0,Math.PI*2);
          ctx.fillStyle='#557e9b';ctx.fill();
          ctx.beginPath();ctx.ellipse(x,y-scale*.05,Math.max(.5,scale*.025),Math.max(1,scale*.052),0,0,Math.PI*2);
          ctx.fillStyle='#c9edfd';ctx.fill();
        }
        if (row.exit) {
          ctx.fillStyle=this.layout.doors;
          const door = Math.max(3,scale*.15);
          ctx.fillRect(left+1,y-door*.7,Math.max(1,bodyMargin-3),door);
          ctx.fillRect(right-bodyMargin+1,y-door*.7,Math.max(1,bodyMargin-3),door);
        }
        if (index>0 && row.cabin!==this.rows[index-1].row.cabin) {
          const splitY=y-lengthScale*.67;
          ctx.fillStyle='#a5b4c790'; ctx.fillRect(left+bodyMargin,splitY,half*2-bodyMargin*2,2);
          const boxSize=Math.min(18,scale*.25);
          ctx.fillStyle='#b9c7d4';ctx.fillRect(left+bodyMargin,splitY-4,boxSize,9);
          ctx.fillRect(right-bodyMargin-boxSize,splitY-4,boxSize,9);
        }
      }

      ctx.fillStyle='#466884';
      const windshield = this.fit ? Math.max(4,scale*.21) : 18;
      ctx.beginPath();
      ctx.moveTo(center-half*.3,top+windshield);
      ctx.quadraticCurveTo(center,top+windshield*.17,center+half*.3,top+windshield);
      ctx.lineTo(center+half*.24,top+windshield*1.33);
      ctx.quadraticCurveTo(center,top+windshield*.77,center-half*.24,top+windshield*1.33);
      ctx.closePath();ctx.fill();
      ctx.restore();

      ctx.textBaseline='middle';
      ctx.textAlign='center';
      ctx.font='700 10px system-ui';
      ctx.fillStyle='#536b82';
      if (!this.fit) {
        ctx.fillText('FRONT',center,Math.max(top+36,floorTop-14));
        ctx.fillText('REAR',center,last+origin*.51);
      }
      for(const {row,z,seats} of this.rows){
        const y=this.projection(0,0,z)[1]-5;
        ctx.fillStyle='#476278';
        ctx.font='750 10px ui-monospace,monospace';
        if (!this.fit) {
          ctx.fillText(String(row.number),left-16,y);
          ctx.fillText(String(row.number),right+16,y);
        }
        if(!this.fit && row.exit && width>560){
          ctx.fillStyle='#974951';ctx.font='750 9px system-ui';
          ctx.fillText('EXIT',left-26,y-11);
          ctx.fillText('EXIT',right+26,y-11);
        }
        for (const seat of seats) {
          const mesh=seatMesh(seat,row,this.layout,this.status(seat),false);
          mesh.sort((a,b)=>{
            const depth=face=>face.points.reduce((n,[x,y,z])=>n+x*.12+y+z*.22,0)/face.points.length;
            return depth(a)-depth(b);
          });
          for(const {points,color} of mesh){
            const [initial,...rest]=points;
            ctx.beginPath();ctx.moveTo(...this.projection(...initial));
            for(const point of rest)ctx.lineTo(...this.projection(...point));
            ctx.closePath();ctx.fillStyle=color;ctx.fill();
          }
        }
      }
    }
  }

  airport.Cabin = Cabin;
  airport.FullDeck = FullDeck;
})(HackAirport);
