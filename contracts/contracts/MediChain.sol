// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MediChain
 * @notice Fake-medicine detection DApp — tracks medicine batches on-chain.
 * @dev Each batch is registered by a manufacturer and passes through
 *      distributor → pharmacy in order. Every handoff is recorded in the
 *      batch history. Batches can be recalled by the original manufacturer
 *      or any REGULATOR_ROLE holder.
 *
 *      Data split:
 *        On-chain  : batch registration, transfers, recalls, history, roles
 *        Off-chain : QR generation, unit serials, scan logs, caching (backend)
 */
contract MediChain is AccessControl {
    // ─── Roles ────────────────────────────────────────────────────────────────

    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE  = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PHARMACY_ROLE     = keccak256("PHARMACY_ROLE");
    bytes32 public constant REGULATOR_ROLE    = keccak256("REGULATOR_ROLE");

    // ─── Types ────────────────────────────────────────────────────────────────

    enum BatchStatus { Active, Recalled }

    /// @notice Stage in the supply chain — used to enforce transfer order.
    enum Stage { Manufacturer, Distributor, Pharmacy }

    struct Batch {
        bytes32 batchId;
        string  drugName;
        string  manufacturerName;
        uint64  manufactureDate;  // unix timestamp
        uint64  expiryDate;       // unix timestamp — must be > block.timestamp at registration
        uint256 quantity;
        bytes32 docHash;          // keccak256 of the lab certificate PDF/JSON (no IPFS)
        address originalManufacturer; // for recall authorization
        address currentHolder;
        Stage   currentStage;
        BatchStatus status;
        string  recallReason;
    }

    struct HandoffRecord {
        address from;
        address to;
        uint64  timestamp;
        string  note;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    mapping(bytes32 => Batch) private _batches;
    mapping(bytes32 => HandoffRecord[]) private _history;

    // batchId existence check (a Batch with zero originalManufacturer is unregistered)
    mapping(bytes32 => bool) private _registered;

    // ─── Events ───────────────────────────────────────────────────────────────

    event BatchRegistered(
        bytes32 indexed batchId,
        address indexed manufacturer,
        string  drugName,
        uint64  expiryDate
    );

    event BatchTransferred(
        bytes32 indexed batchId,
        address indexed from,
        address indexed to,
        uint64  timestamp,
        string  note
    );

    event BatchRecalled(
        bytes32 indexed batchId,
        address indexed recalledBy,
        string  reason
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address admin) {
        // Grant the deployer the DEFAULT_ADMIN_ROLE so they can grant other roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier batchExists(bytes32 batchId) {
        require(_registered[batchId], "MediChain: batch not registered");
        _;
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /**
     * @notice Register a new medicine batch on-chain.
     * @dev Only accounts with MANUFACTURER_ROLE may call this.
     *      The caller becomes the initial holder at Stage.Manufacturer.
     * @param batchId         Unique identifier (e.g., keccak256 of lot+serial).
     * @param drugName        Human-readable drug name.
     * @param manufacturerName Company name of the manufacturer.
     * @param manufactureDate Unix timestamp of manufacturing date.
     * @param expiryDate      Unix timestamp — MUST be in the future.
     * @param quantity        Number of units in the batch.
     * @param docHash         keccak256 hash of the lab certificate document.
     */
    function registerBatch(
        bytes32 batchId,
        string calldata drugName,
        string calldata manufacturerName,
        uint64  manufactureDate,
        uint64  expiryDate,
        uint256 quantity,
        bytes32 docHash
    ) external onlyRole(MANUFACTURER_ROLE) {
        require(!_registered[batchId], "MediChain: batchId already registered");
        require(expiryDate > uint64(block.timestamp), "MediChain: expiryDate must be in the future");
        require(bytes(drugName).length > 0, "MediChain: drugName required");
        require(quantity > 0, "MediChain: quantity must be > 0");

        _batches[batchId] = Batch({
            batchId:              batchId,
            drugName:             drugName,
            manufacturerName:     manufacturerName,
            manufactureDate:      manufactureDate,
            expiryDate:           expiryDate,
            quantity:             quantity,
            docHash:              docHash,
            originalManufacturer: msg.sender,
            currentHolder:        msg.sender,
            currentStage:         Stage.Manufacturer,
            status:               BatchStatus.Active,
            recallReason:         ""
        });
        _registered[batchId] = true;

        emit BatchRegistered(batchId, msg.sender, drugName, expiryDate);
    }

    /**
     * @notice Transfer a batch to the next party in the supply chain.
     * @dev Transfer order is strictly enforced:
     *        Manufacturer → Distributor → Pharmacy
     *      Only the current holder may initiate a transfer.
     *      Recalled or expired batches cannot be transferred.
     * @param batchId Batch identifier.
     * @param to      Recipient address (must hold the next-stage role).
     * @param note    Optional human-readable note (e.g., "delivered to warehouse").
     */
    function transferBatch(
        bytes32 batchId,
        address to,
        string calldata note
    ) external batchExists(batchId) {
        Batch storage b = _batches[batchId];

        require(msg.sender == b.currentHolder, "MediChain: caller is not the current holder");
        require(b.status == BatchStatus.Active, "MediChain: batch is recalled");
        require(b.expiryDate > uint64(block.timestamp), "MediChain: batch has expired");

        // Enforce transfer order based on the CURRENT stage
        if (b.currentStage == Stage.Manufacturer) {
            // Manufacturer → must transfer to a Distributor
            require(
                hasRole(DISTRIBUTOR_ROLE, to),
                "MediChain: manufacturer must transfer to a distributor"
            );
            b.currentStage = Stage.Distributor;
        } else if (b.currentStage == Stage.Distributor) {
            // Distributor → must transfer to a Pharmacy
            require(
                hasRole(PHARMACY_ROLE, to),
                "MediChain: distributor must transfer to a pharmacy"
            );
            b.currentStage = Stage.Pharmacy;
        } else {
            // Pharmacy is the final stage — no further transfers allowed
            revert("MediChain: batch has reached its final destination (pharmacy)");
        }

        // Record the handoff in history
        _history[batchId].push(HandoffRecord({
            from:      msg.sender,
            to:        to,
            timestamp: uint64(block.timestamp),
            note:      note
        }));

        b.currentHolder = to;

        emit BatchTransferred(batchId, msg.sender, to, uint64(block.timestamp), note);
    }

    /**
     * @notice Recall a batch, halting any further transfers.
     * @dev Can be called by the original manufacturer OR any REGULATOR_ROLE holder.
     * @param batchId Batch identifier.
     * @param reason  Human-readable recall reason.
     */
    function recallBatch(
        bytes32 batchId,
        string calldata reason
    ) external batchExists(batchId) {
        Batch storage b = _batches[batchId];

        require(
            msg.sender == b.originalManufacturer || hasRole(REGULATOR_ROLE, msg.sender),
            "MediChain: only original manufacturer or regulator can recall"
        );
        require(b.status != BatchStatus.Recalled, "MediChain: batch already recalled");
        require(bytes(reason).length > 0, "MediChain: recall reason required");

        b.status = BatchStatus.Recalled;
        b.recallReason = reason;

        emit BatchRecalled(batchId, msg.sender, reason);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Returns the full batch struct for a given batchId.
     */
    function getBatch(bytes32 batchId)
        external
        view
        batchExists(batchId)
        returns (Batch memory)
    {
        return _batches[batchId];
    }

    /**
     * @notice Returns the full transfer history of a batch.
     * @return Array of HandoffRecord structs (from, to, timestamp, note).
     */
    function getHistory(bytes32 batchId)
        external
        view
        batchExists(batchId)
        returns (HandoffRecord[] memory)
    {
        return _history[batchId];
    }

    /**
     * @notice Convenience: check if a batchId is registered.
     */
    function isRegistered(bytes32 batchId) external view returns (bool) {
        return _registered[batchId];
    }

    /**
     * @notice Convenience: get the current stage of a batch as a string.
     */
    function getCurrentStage(bytes32 batchId)
        external
        view
        batchExists(batchId)
        returns (string memory)
    {
        Stage s = _batches[batchId].currentStage;
        if (s == Stage.Manufacturer) return "Manufacturer";
        if (s == Stage.Distributor)  return "Distributor";
        return "Pharmacy";
    }
}
