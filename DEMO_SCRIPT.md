# MediChain — Demo Script
## 2.5-Minute Hackathon Video Script

**Persona**: Priya Sharma, 28, pharmacist at Apollo Pharmacy, Pune  
**Setting**: A busy pharmacy counter. Priya's phone is open to the MediChain app.

---

### [0:00–0:20] Opening Hook

**[Narrator V.O.]**
> "Every year, millions of people unknowingly buy counterfeit medicine.
> The problem? Supply chains with no accountability and no transparency.
> MediChain puts the medicine supply chain on the blockchain — permanently."

**[Screen]**: Show the MediChain landing page: *"Scan it. Trust it."*

---

### [0:20–0:45] Scenario 1 — VERIFIED ✅

**[Priya on camera]**
> "A patient just handed me these Amoxicillin tablets. Let me check them."

**[Action]**: Priya opens `/scan` on her phone. She holds it up to the Amoxicillin QR code.

**[Screen]**: Camera activates. QR detected. Loading spinner for ~1.5s.

**[Screen]**: Giant **green VERIFIED** badge appears with pulsing glow.

**[Priya]**
> "Green — VERIFIED. And look: I can see the entire journey."

**[Screen]**: Scroll through the journey timeline:
- 🏭 **Manufacturer** — PharmaCo Ltd — [date]
- 🚚 **Distributor** — Mumbai Warehouse — [date]
- 🏥 **Pharmacy** — Apollo Pharmacy Pune — [date] ← Current

**[Priya]**
> "Three on-chain transactions. Nobody could have changed this history."

---

### [0:45–1:15] Scenario 2 — EXPIRED ⏰

**[Priya]**
> "Now this Azithromycin batch — it expired just a few minutes ago."

**[Action]**: Scan the Azithromycin QR code.

**[Screen]**: **Red EXPIRED** badge with glow animation.
> "This batch expired on [exact date/time]. Do not dispense."

**[Priya]**
> "The blockchain knows the exact expiry date that was registered at manufacture.
> No human can override it."

---

### [1:15–1:45] Scenario 3 — RECALLED ⛔ (Live!)

**[Priya]**
> "Now for something dramatic. These Paracetamol tablets — let me scan them first."

**[Action]**: Scan the Paracetamol QR.

**[Screen]**: Green **VERIFIED** badge. Looks fine.

**[Priya]**
> "VERIFIED right now. But watch what happens when a regulator issues a recall."

**[Action]**: Switch to the Dashboard on a laptop. Connect MetaMask as Regulator wallet.

**[Screen]**: Regulator panel visible. Enter lot number `PARA-DEMO-001`, reason: *"Contamination found in batch C-2024"*.

**[Action]**: Click **Issue Recall Order**. MetaMask popup appears. Confirm.

**[Screen]**: Transaction pending toast → "Waiting for confirmation…" → Green success toast with Explorer link.

**[Priya]** *(switching back to phone)*
> "Now let me scan again."

**[Action]**: Scan the same Paracetamol QR.

**[Screen]**: Giant **red RECALLED** badge.
> "This batch has been recalled: Contamination found in batch C-2024."

**[Priya]**
> "The moment that transaction confirmed on-chain, every patient's next scan would see RECALLED.
> No central server to hack. No phone call to the pharmacy. Instant, global, permanent."

---

### [1:45–2:05] Scenario 4 — IN TRANSIT ↗

**[Narrator]**
> "And what about medicine that hasn't reached a pharmacy yet?"

**[Action]**: Scan the Metformin QR.

**[Screen]**: **Blue IN TRANSIT** badge.
> "In transit — this batch is currently at a Distributor and has not reached a pharmacy yet."

**[Narrator]**
> "Soft warning. Not suspicious — just not at the pharmacy stage yet.
> You can see exactly where it is in the supply chain."

---

### [2:05–2:30] Architecture & Close

**[Screen]**: Show the architecture diagram briefly.

**[Narrator]**
> "Under the hood: MediChain.sol on MST Testnet.
> OpenZeppelin AccessControl. Role-enforced transfer order.
> A Node.js backend with a 45-second cache — verify in under 2 seconds.
> React frontend, mobile-first, deployable on Vercel in minutes."

**[Screen]**: Show the on-chain contract on testnet.mstscan.com

**[Narrator]**
> "Three parties who don't trust each other.
> One ledger nobody can alter.
> One scan that tells you the truth."

**[Screen]**: Landing page. Tagline pulses: **"Scan it. Trust it."**

**[Narrator]**
> "MediChain."

---

### Post-Video Notes (for presenters)

**Timings to hit during live demo**:
- Azithromycin expiry time is printed by `seed.js` — check `seed-output.json`
- For the recall live flip, have the Regulator MetaMask pre-connected before recording
- Use a second phone/incognito window for the Suspicious scenario (bonus)

**Explorer links to keep open**:
- Contract: `https://testnet.mstscan.com/address/YOUR_CONTRACT`
- Recall TX: paste from MetaMask after confirming
