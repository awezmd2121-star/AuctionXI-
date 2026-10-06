# AuctionXI V1

Standalone new project. It does not modify the existing Cricket-Auction app.

## Included
- Email/password Firebase login
- Admin/team role foundation
- Tournament settings
- 1200 / 8 / 30 defaults
- Correct starting max bid: 960
- Team dashboard foundation
- Mobile-first interface

## Before use
1. Replace the placeholder firebaseConfig in app.js with the NEW Firebase Web App config.
2. Create the admin Auth user.
3. In Realtime Database create users/<ADMIN_UID> with:
   { "role": "admin", "name": "Admin" }
4. Apply firebase-rules.json only after checking it in the Firebase Rules simulator.
5. Team account provisioning will be added securely in the next build stage.

Never place Firebase service-account private keys in this website.
