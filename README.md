AUCTIONXI V2 — Player System

This is a NEW project and does not modify the old Cricket-Auction app.

V2 adds:
- Admin player registration
- Required photo, full name, city/area, CricHeroes number
- Optional previous tournament/team
- Automatic Player ID (AXI-0001 style)
- Pending / Approved / Rejected workflow
- Permanent player database in Realtime Database
- Select approved players for auction
- Auction player chart with Available / Sold / Unsold status

IMPORTANT:
1. Keep your existing Firebase config from your working AuctionXI app.js.
2. In the new app.js, replace the firebaseConfig placeholders with that same config.
3. V2 stores compressed player photos directly in Realtime Database for this stage, so Firebase Storage is NOT required.
4. Deploy the included database rules in Firebase Realtime Database > Rules.
5. The rules are starter V2 rules. Before a public tournament, tighten team/player visibility further.

V2 does not yet implement live bidding. That is V3.
