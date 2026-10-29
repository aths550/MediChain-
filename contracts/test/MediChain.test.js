/**
 * MediChain.test.js
 * Comprehensive Hardhat/Mocha/Chai tests for MediChain.sol
 *
 * Coverage:
 *  1. Deployment & admin role
 *  2. Role grants
 *  3. Happy path: register → transfer mfg→dist → transfer dist→pharmacy
 *  4. Duplicate batchId reverts
 *  5. Wrong-role transfer reverts (mfg cannot transfer to pharmacy directly)
 *  6. Out-of-order transfer reverts (mfg→pharmacy skipping distributor)
 *  7. Non-holder transfer reverts
 *  8. Recalled batch transfer reverts
 *  9. Expired batch transfer reverts
 * 10. Recall flow — manufacturer can recall
 * 11. Recall flow — regulator can recall
 * 12. Non-authorized recall reverts
 * 13. Double-recall reverts
 * 14. getBatch / getHistory return correct data
 * 15. expiryDate in the past reverts on registerBatch
 * 16. Pharmacy cannot transfer further
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
// Helper to generate a unique batchId
let batchCounter = 0;
function makeBatchId(label = "") {
  batchCounter++;
  return ethers.keccak256(ethers.toUtf8Bytes(`batch-${label}-${batchCounter}-${Date.now()}`));
}

const DAY = 86400n;
const YEAR = 365n * DAY;

describe("MediChain", function () {
  let medichain;
  let admin, manufacturer, distributor, pharmacy, regulator, stranger;

  // Roles
  const MANUFACTURER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANUFACTURER_ROLE"));
  const DISTRIBUTOR_ROLE  = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
  const PHARMACY_ROLE     = ethers.keccak256(ethers.toUtf8Bytes("PHARMACY_ROLE"));
  const REGULATOR_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("REGULATOR_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  async function deployFixture() {
    [admin, manufacturer, distributor, pharmacy, regulator, stranger] =
      await ethers.getSigners();

    const MediChain = await ethers.getContractFactory("MediChain");
    medichain = await MediChain.deploy(admin.address);
    await medichain.waitForDeployment();

    // Grant roles
    await medichain.connect(admin).grantRole(MANUFACTURER_ROLE, manufacturer.address);
    await medichain.connect(admin).grantRole(DISTRIBUTOR_ROLE,  distributor.address);
    await medichain.connect(admin).grantRole(PHARMACY_ROLE,     pharmacy.address);
    await medichain.connect(admin).grantRole(REGULATOR_ROLE,    regulator.address);

    return { medichain, admin, manufacturer, distributor, pharmacy, regulator, stranger };
  }

  // Helper: register a batch with sensible defaults
  async function registerBatch(overrides = {}) {
    const now = BigInt(await time.latest());
    const batchId = overrides.batchId ?? makeBatchId("test");
    const expiryDate = overrides.expiryDate ?? now + YEAR;
    const caller = overrides.caller ?? manufacturer;

    await medichain.connect(caller).registerBatch(
      batchId,
      overrides.drugName ?? "TestDrug 500mg",
      overrides.manufacturerName ?? "PharmaCo Ltd",
      now - DAY,      // manufactureDate (yesterday)
      expiryDate,
      overrides.quantity ?? 1000n,
      overrides.docHash ?? ethers.keccak256(ethers.toUtf8Bytes("doc"))
    );

    return batchId;
  }

  // ─── 1. Deployment ──────────────────────────────────────────────────────────

  describe("1. Deployment", function () {
    before(async function () { await deployFixture(); });

    it("grants DEFAULT_ADMIN_ROLE to admin", async function () {
      expect(await medichain.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("admin does not automatically have MANUFACTURER_ROLE", async function () {
      expect(await medichain.hasRole(MANUFACTURER_ROLE, admin.address)).to.be.false;
    });
  });

  // ─── 2. Role Grants ─────────────────────────────────────────────────────────

  describe("2. Role grants", function () {
    before(async function () { await deployFixture(); });

    it("manufacturer has MANUFACTURER_ROLE", async function () {
      expect(await medichain.hasRole(MANUFACTURER_ROLE, manufacturer.address)).to.be.true;
    });

    it("distributor has DISTRIBUTOR_ROLE", async function () {
      expect(await medichain.hasRole(DISTRIBUTOR_ROLE, distributor.address)).to.be.true;
    });

    it("pharmacy has PHARMACY_ROLE", async function () {
      expect(await medichain.hasRole(PHARMACY_ROLE, pharmacy.address)).to.be.true;
    });

    it("regulator has REGULATOR_ROLE", async function () {
      expect(await medichain.hasRole(REGULATOR_ROLE, regulator.address)).to.be.true;
    });
  });

  // ─── 3. Happy Path ──────────────────────────────────────────────────────────

  describe("3. Happy path — full journey", function () {
    let batchId;

    before(async function () {
      await deployFixture();
      batchId = await registerBatch();
    });

    it("emits BatchRegistered event", async function () {
      const batchId2 = makeBatchId("event-test");
      const now = BigInt(await time.latest());
      await expect(
        medichain.connect(manufacturer).registerBatch(
          batchId2, "EventDrug", "Co", now - DAY, now + YEAR, 100n, ethers.ZeroHash
        )
      ).to.emit(medichain, "BatchRegistered").withArgs(
        batchId2, manufacturer.address, "EventDrug", now + YEAR
      );
    });

    it("batch is at Manufacturer stage after registration", async function () {
      const batch = await medichain.getBatch(batchId);
      expect(batch.currentHolder).to.equal(manufacturer.address);
      expect(batch.currentStage).to.equal(0n); // Stage.Manufacturer
      expect(batch.status).to.equal(0n); // BatchStatus.Active
    });

    it("manufacturer transfers to distributor and emits BatchTransferred", async function () {
      await expect(
        medichain.connect(manufacturer).transferBatch(batchId, distributor.address, "Sent to warehouse")
      ).to.emit(medichain, "BatchTransferred")
        .withArgs(batchId, manufacturer.address, distributor.address, anyValue, "Sent to warehouse");

      const batch = await medichain.getBatch(batchId);
      expect(batch.currentHolder).to.equal(distributor.address);
      expect(batch.currentStage).to.equal(1n); // Stage.Distributor
    });

    it("distributor transfers to pharmacy", async function () {
      await medichain.connect(distributor).transferBatch(batchId, pharmacy.address, "Delivered to pharmacy");
      const batch = await medichain.getBatch(batchId);
      expect(batch.currentHolder).to.equal(pharmacy.address);
      expect(batch.currentStage).to.equal(2n); // Stage.Pharmacy
    });

    it("getHistory returns 2 handoff records in order", async function () {
      const history = await medichain.getHistory(batchId);
      expect(history.length).to.equal(2);
      expect(history[0].from).to.equal(manufacturer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[0].note).to.equal("Sent to warehouse");
      expect(history[1].from).to.equal(distributor.address);
      expect(history[1].to).to.equal(pharmacy.address);
      expect(history[1].note).to.equal("Delivered to pharmacy");
    });

    it("getBatch returns full correct data", async function () {
      const batch = await medichain.getBatch(batchId);
      expect(batch.drugName).to.equal("TestDrug 500mg");
      expect(batch.manufacturerName).to.equal("PharmaCo Ltd");
      expect(batch.quantity).to.equal(1000n);
      expect(batch.originalManufacturer).to.equal(manufacturer.address);
      expect(batch.status).to.equal(0n);
    });
  });

  // ─── 4. Duplicate batchId ───────────────────────────────────────────────────

  describe("4. Duplicate batchId", function () {
    before(async function () { await deployFixture(); });

    it("reverts when registering an already-registered batchId", async function () {
      const batchId = await registerBatch();
      await expect(registerBatch({ batchId })).to.be.revertedWith(
        "MediChain: batchId already registered"
      );
    });
  });

  // ─── 5. Wrong-role transfer ─────────────────────────────────────────────────

  describe("5. Wrong-role transfer reverts", function () {
    before(async function () { await deployFixture(); });

    it("reverts if manufacturer tries to transfer directly to pharmacy", async function () {
      const batchId = await registerBatch();
      // pharmacy has PHARMACY_ROLE but manufacturer cannot skip distributor
      await expect(
        medichain.connect(manufacturer).transferBatch(batchId, pharmacy.address, "skip")
      ).to.be.revertedWith("MediChain: manufacturer must transfer to a distributor");
    });

    it("reverts if manufacturer tries to transfer to another manufacturer", async function () {
      // stranger has no role at all
      const batchId = await registerBatch();
      await expect(
        medichain.connect(manufacturer).transferBatch(batchId, stranger.address, "wrong")
      ).to.be.revertedWith("MediChain: manufacturer must transfer to a distributor");
    });

    it("reverts if distributor tries to transfer to another distributor", async function () {
      const batchId = await registerBatch();
      // Give stranger distributor role
      await medichain.connect(admin).grantRole(DISTRIBUTOR_ROLE, stranger.address);
      await medichain.connect(manufacturer).transferBatch(batchId, distributor.address, "ok");
      // distributor must go to pharmacy, not another distributor
      await expect(
        medichain.connect(distributor).transferBatch(batchId, stranger.address, "wrong")
      ).to.be.revertedWith("MediChain: distributor must transfer to a pharmacy");
    });
  });

  // ─── 6. Out-of-order transfer ───────────────────────────────────────────────

  describe("6. Non-holder transfer reverts", function () {
    before(async function () { await deployFixture(); });

    it("reverts if a non-holder tries to transfer", async function () {
      const batchId = await registerBatch();
      // distributor is not the holder yet
      await expect(
        medichain.connect(distributor).transferBatch(batchId, pharmacy.address, "cheat")
      ).to.be.revertedWith("MediChain: caller is not the current holder");
    });

    it("reverts if stranger tries to transfer", async function () {
      const batchId = await registerBatch();
      await expect(
        medichain.connect(stranger).transferBatch(batchId, distributor.address, "hack")
      ).to.be.revertedWith("MediChain: caller is not the current holder");
    });
  });

  // ─── 7. Pharmacy cannot transfer further ────────────────────────────────────

  describe("7. Pharmacy is the final stage", function () {
    before(async function () { await deployFixture(); });

    it("reverts when pharmacy tries to transfer", async function () {
      const batchId = await registerBatch();
      await medichain.connect(manufacturer).transferBatch(batchId, distributor.address, "1");
      await medichain.connect(distributor).transferBatch(batchId, pharmacy.address, "2");
      await expect(
        medichain.connect(pharmacy).transferBatch(batchId, stranger.address, "sell")
      ).to.be.revertedWith("MediChain: batch has reached its final destination (pharmacy)");
    });
  });

  // ─── 8. Recalled batch transfer ─────────────────────────────────────────────

  describe("8. Recalled batch transfer reverts", function () {
    before(async function () { await deployFixture(); });

    it("reverts transfer of a recalled batch", async function () {
      const batchId = await registerBatch();
      await medichain.connect(manufacturer).recallBatch(batchId, "Contamination detected");
      await expect(
        medichain.connect(manufacturer).transferBatch(batchId, distributor.address, "try")
      ).to.be.revertedWith("MediChain: batch is recalled");
    });
  });

  // ─── 9. Expired batch transfer ──────────────────────────────────────────────

  describe("9. Expired batch transfer reverts", function () {
    before(async function () { await deployFixture(); });

    it("reverts transfer of an expired batch", async function () {
      const now = BigInt(await time.latest());
      // Set expiry 10 seconds in the future
      const batchId = await registerBatch({ expiryDate: now + 10n });

      // Time-travel past expiry
      await time.increase(20);

      await expect(
        medichain.connect(manufacturer).transferBatch(batchId, distributor.address, "expired")
      ).to.be.revertedWith("MediChain: batch has expired");
    });

    it("reverts registerBatch if expiryDate is in the past", async function () {
      const now = BigInt(await time.latest());
      const batchId = makeBatchId("past-expiry");
      await expect(
        medichain.connect(manufacturer).registerBatch(
          batchId, "Drug", "Co", now - 2n * DAY, now - DAY, 100n, ethers.ZeroHash
        )
      ).to.be.revertedWith("MediChain: expiryDate must be in the future");
    });
  });

  // ─── 10. Recall — manufacturer ──────────────────────────────────────────────

  describe("10. Recall by manufacturer", function () {
    before(async function () { await deployFixture(); });

    it("manufacturer can recall their own batch", async function () {
      const batchId = await registerBatch();
      await expect(
        medichain.connect(manufacturer).recallBatch(batchId, "Contamination")
      ).to.emit(medichain, "BatchRecalled")
        .withArgs(batchId, manufacturer.address, "Contamination");

      const batch = await medichain.getBatch(batchId);
      expect(batch.status).to.equal(1n); // BatchStatus.Recalled
      expect(batch.recallReason).to.equal("Contamination");
    });
  });

  // ─── 11. Recall — regulator ─────────────────────────────────────────────────

  describe("11. Recall by regulator", function () {
    before(async function () { await deployFixture(); });

    it("regulator can recall any batch", async function () {
      const batchId = await registerBatch();
      await medichain.connect(regulator).recallBatch(batchId, "Regulatory order");
      const batch = await medichain.getBatch(batchId);
      expect(batch.status).to.equal(1n);
      expect(batch.recallReason).to.equal("Regulatory order");
    });
  });

  // ─── 12. Non-authorized recall reverts ──────────────────────────────────────

  describe("12. Non-authorized recall reverts", function () {
    before(async function () { await deployFixture(); });

    it("distributor cannot recall a batch", async function () {
      const batchId = await registerBatch();
      await expect(
        medichain.connect(distributor).recallBatch(batchId, "Try")
      ).to.be.revertedWith(
        "MediChain: only original manufacturer or regulator can recall"
      );
    });

    it("stranger cannot recall a batch", async function () {
      const batchId = await registerBatch();
      await expect(
        medichain.connect(stranger).recallBatch(batchId, "Hack")
      ).to.be.revertedWith(
        "MediChain: only original manufacturer or regulator can recall"
      );
    });
  });

  // ─── 13. Double-recall reverts ──────────────────────────────────────────────

  describe("13. Double-recall reverts", function () {
    before(async function () { await deployFixture(); });

    it("cannot recall an already recalled batch", async function () {
      const batchId = await registerBatch();
      await medichain.connect(manufacturer).recallBatch(batchId, "First recall");
      await expect(
        medichain.connect(regulator).recallBatch(batchId, "Second recall")
      ).to.be.revertedWith("MediChain: batch already recalled");
    });
  });

  // ─── 14. Unknown batch reverts ──────────────────────────────────────────────

  describe("14. Unknown batch reverts", function () {
    before(async function () { await deployFixture(); });

    it("getBatch reverts for unregistered batchId", async function () {
      const fakeBatchId = makeBatchId("fake");
      await expect(medichain.getBatch(fakeBatchId)).to.be.revertedWith(
        "MediChain: batch not registered"
      );
    });

    it("getHistory reverts for unregistered batchId", async function () {
      const fakeBatchId = makeBatchId("fake2");
      await expect(medichain.getHistory(fakeBatchId)).to.be.revertedWith(
        "MediChain: batch not registered"
      );
    });

    it("isRegistered returns false for unknown batchId", async function () {
      const fakeBatchId = makeBatchId("fake3");
      expect(await medichain.isRegistered(fakeBatchId)).to.be.false;
    });
  });

  // ─── 15. No-role registration reverts ───────────────────────────────────────

  describe("15. Role enforcement on registerBatch", function () {
    before(async function () { await deployFixture(); });

    it("reverts if stranger tries to register a batch", async function () {
      const batchId = makeBatchId("noauth");
      const now = BigInt(await time.latest());
      await expect(
        medichain.connect(stranger).registerBatch(
          batchId, "Drug", "Co", now - DAY, now + YEAR, 100n, ethers.ZeroHash
        )
      ).to.be.reverted; // AccessControl revert
    });
  });
});
