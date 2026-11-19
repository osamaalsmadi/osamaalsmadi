# Hack Airport

A self-contained airport and passenger-booking simulator with six international departures, real reference photography and six navigable 3D cabins. It includes three manual security labs with replayable fixes.

Live demo: https://hack-airport-lab.chippersequoia4.chatgpt.site

> **Course project:** This is an educational, browser-only security simulation. Flight availability, passenger records, prices, coupons and payments are fictional demo data. No airline, payment processor or passenger account is connected.

## Project goals and requirements

The project models the passenger flow of an airport booking website and provides a visible, repeatable way to study three application-security weaknesses and their fixes.

- Present a departure board with multiple routes, airlines, times, aircraft types and searchable flight details.
- Let a passenger select a flight, inspect its aircraft and cabin, and view the full seat map with available, booked and VIP seats.
- Provide aircraft-specific seat layouts and a cabin walkthrough with 3D-style perspective, aisle and seat views, plus a 2D map.
- Complete a simulated booking with passenger details, optional baggage or meal, demo payment outcome, confirmation and boarding pass.
- Keep the interface usable without a server or account, with local browser storage for demo trips.
- Demonstrate Ticket IDOR, Broken Access Control and coupon replay as isolated, fictional scenarios. Each lab has an explicit **Vulnerable / Fixed** mode and shows the request, response and visible effect.
- Explain how to reproduce each scenario, how the fix changes the result, and how to run the project locally.

The interface and sample records are designed to resemble a commercial airline booking flow. The schedule and aircraft references are documented below; passenger activity and transaction state remain a local simulation.

## Run locally

Extract the whole ZIP and open `index.html` in a modern desktop or mobile browser. Keep the five HTML pages and `assets` in the same folder. App code, maps, and photos load locally. Source and photo-credit links open their publishers when used. The same folder can be served by any static host.

1. Search the departure board by airline, city, airport or flight number. Each entry shows its simulated availability.
2. Choose **View flight**. The complete aircraft seat map and available, booked and VIP seats are immediately shown beneath the schedule and aircraft photograph.
3. **Full cabin** is the default. Scroll through every seat on the map. **Fit aircraft** fits the whole layout into a compact overview. Both A380 decks appear together there. Use the individual deck links when browsing seats.
4. Select an available seat. The trip panel shows the real class name and demo price. Business, Crown, Qsuite and First are marked **VIP**. Premium Economy retains its own class. **3D walkthrough**, **Aisle view** and **View from this seat** show the interior from different perspectives. **2D map** provides a flat alternative.
5. Continue to booking, enter a fictional passenger name, optionally add an in-flight meal or checked bag, and approve or decline a demo payment. Confirmed reservations and boarding passes appear under **My trips** and are saved where browser storage is available.

## Schedule and cabin references

The sample records retain the local times published for 14–17 November 2026. The aircraft types and seat configurations are listed per flight. The 3D shapes reconstruct the layouts for interaction. Materials, lighting, pitch and view angle are illustrative. A representative aircraft photo shows the same model and airline, and actual aircraft assignments can change. Fares, payments, available seats and passenger identities are simulated.

| Flight | Route | Date | Published local times | Aircraft and modeled configuration |
| --- | --- | --- | --- | --- |
| [RJ 407](https://www.flightstats.com/v2/flight-tracker/RJ/407?date=14&flightId=1419798698&month=11&year=2026) | Amman → Beirut | 14 Nov | 05:00 → 05:05 | [E195-E2, 122 seats](https://knowmyseat.com/aircraft/rj-royal-jordanian--e195-e2-v-2), Crown and Economy in 2–2 |
| [TK 815](https://www.flightstats.com/v2/flight-tracker/TK/815?date=15&flightId=1419994771&month=11&year=2026) | Amman → Istanbul | 15 Nov | 06:15 → 08:55 | [A321neo, 190 seats](https://www.aerolopa.com/tk-32q-2), 2–2 Business and 3–3 Economy |
| [EK 904](https://www.flightstats.com/v2/flight-tracker/EK/904?date=16&flightId=1420137743&month=11&year=2026) | Amman → Dubai | 16 Nov | 18:45 → 22:40 | [A380-800, 484 seats](https://www.aerolopa.com/ek-388y), Economy and Premium Economy on the main deck, First and Business on the upper deck |
| [EK 660](https://www.flight.info/EK660) | Dubai → Malé | 16 Nov | 10:15 → 15:30 | [777-300ER, 328 seats](https://www.aerolopa.com/ek-77ws), four cabins including 3–4–3 Economy |
| [QR 944](https://www.flight.info/QR944) | Doha → Singapore | 16 Nov | 08:25 → 21:15 | [A350-900, 283 seats](https://www.qatarairways.com/content/dam/documents/fleet/archive/Qsuite-A350-900.pdf), alternating Qsuite rows and 3–3–3 Economy |
| [RJ 261](https://www.flightstats.com/v2/flight-tracker/RJ/261?date=17&flightId=1420340473&month=11&year=2026) | Amman → New York | 17 Nov | 12:15 → 16:15 | [787-8, 270 seats](https://seatmap.org/en/airlines/royal-jordanian/royal-jordanian-boeing-787-8-788), 2–2–2 Crown and 3–3–3 Economy |

Detailed configuration cross-checks include the [A380 main deck](https://seatinfo.com/seat-maps/emirates/airbus-a380-800-cabin-layout-ek-388y) and [upper deck](https://seatinfo.com/seat-maps/emirates/airbus-a380-800-cabin-layout-ek-388y-upper), plus the [777-300ER row chart](https://seatinfo.com/seat-maps/emirates/boeing-777-300er-cabin-layout-ek-77ws) and [Qsuite row chart](https://seatinfo.com/seat-maps/qatar-airways/airbus-a350-900-cabin-layout-qr-359-2).

See [PHOTO_CREDITS.md](PHOTO_CREDITS.md) and [INTERIOR_CREDITS.md](INTERIOR_CREDITS.md) for image authors and licenses. Photographs show genuine reference cabins of the same aircraft model. Each photo caption identifies the reference airline when known, and the interactive seat map uses the selected flight’s documented layout.

## Security labs

Open a flight and scroll to **Security labs**. Open a lab and press one of its payload buttons. The matching request, active handler, response and visible effect appear on the page. Switch the mode from **Vulnerable** to **Fixed**, then press the same payload button again to see **Blocked**. Switching back to **Vulnerable** resets the lab. The effect panel compares the passenger, fare, or discount state. **Copy result link** and **Open result** reopen the selected scenario with its exploited or blocked result. The scenarios use fictional records in a local browser simulation.

| Lab | Vulnerable behavior | Fixed behavior | What to observe |
| --- | --- | --- | --- |
| Ticket IDOR | Changing a predictable ticket reference returns another fictional passenger's boarding pass. | Ownership is checked before ticket data is returned; the same request is denied. | Compare the ticket owner and response status for `HA-1042` and `HA-1043`. |
| Broken Access Control | A customer can open the simulated operations view and submit a fare change without an authorized role. | The handler checks the user's role and rejects the customer request. | Compare the fare before and after the request, and inspect the authorization result. |
| Coupon replay | Replaying the same discount request can apply the demo coupon again. | The coupon redemption is tracked and a duplicate attempt is rejected. | Compare the discount total and request result after the first and repeated submission. |

### Suggested lab walkthrough

1. Start with **Vulnerable** mode and record the displayed request and starting state.
2. Press the lab's payload control once and note the response and visible impact.
3. Switch to **Fixed** mode. The page shows the protected handler; repeat the same payload.
4. Confirm that the repeated request is blocked and the protected state remains intact.
5. Switch to **Vulnerable** mode to reset the local scenario before another walkthrough.

The labs are deterministic client-side teaching examples. They do not send attack traffic to an airline or external service, and the displayed requests are simulated by local JavaScript handlers. The security lessons are authorization by object ownership, role enforcement on sensitive actions, and server-side idempotency or one-time redemption for coupons.

You can also perform the tests manually from the address bar. Add `flight=rj407`, `flight=tk815`, `flight=ek904`, `flight=ek660`, `flight=qr944`, or `flight=rj261` to change the flight shown. The examples below default to RJ 407.

| Exercise | Address | Manual step |
| --- | --- | --- |
| Ticket IDOR | `ticket.html?ticket=HA-1042` | Change `HA-1042` to `HA-1043`. The foreign boarding pass returns 200. |
| Unauthorized fare edit | `operations.html` | Add `?view=admin` as the customer. Type a new fare and press Enter. |
| Coupon replay | `checkout.html` | Apply `FIRST25` and replay the exact request through **Request console** using Ctrl+Enter or Cmd+Enter. |

After a successful attempt, switching to **Fixed** shows a side-by-side comparison using the same request and its original starting state. In the coupon lab, the guided attack prepares one legitimate discount before sending the repeat. The full procedure is in [MANUAL_LABS_AR.md](MANUAL_LABS_AR.md).

## Files

- `index.html`, `flight.html`: flight board, aircraft photos, cabin, selection, checkout and trips.
- `ticket.html`, `operations.html`, `checkout.html`: the isolated security exercises.
- `assets/flights.js`: schedule snapshot, seat rows and class configurations.
- `assets/cabin.js`: 3D seat/room geometry, perspective projection, seat controls and camera.
- `assets/booking.js`, `assets/flight-page.js`: reservation, demo payment and boarding pass.
- `assets/security.js`, `assets/labs.js`: local request handlers, vulnerable/fixed rules and exact replay.

## Limitations and safe use

- The flight times are a documented reference snapshot, not a live schedule feed. Check with the airline before making travel plans.
- Seats, seat availability, prices, bookings, passenger identities, coupons and payment outcomes are simulated and are not valid for real travel or purchase.
- The cabin visualization is an interactive reconstruction of published seat layouts; it is not an operational aircraft model.
- Use the labs only as part of this local educational project. Do not apply the examples to real booking systems or accounts.

## License and image attribution

Image sources and license notes are recorded in [PHOTO_CREDITS.md](PHOTO_CREDITS.md) and [INTERIOR_CREDITS.md](INTERIOR_CREDITS.md). No separate software license is declared in this project.
