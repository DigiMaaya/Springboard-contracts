// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ProjectSale
 * @notice Handles stablecoin contributions, caps, whitelist, refunds, and finalization
 *         for a single project's token sale. Deployed and registered by SpringboardFactory.
 */
contract ProjectSale is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");

    enum Status {
        Pending,
        Active,
        Ended,
        Finalized
    }

    // ─────────────────────────────────────────────
    // Immutable sale configuration (locked at deployment)
    // ─────────────────────────────────────────────

    uint256 public immutable projectId;
    address public immutable tokenAddress;
    IERC20 public immutable paymentToken;
    address public immutable treasury;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable softCap;
    uint256 public immutable hardCap;
    uint256 public immutable minContribution;
    uint256 public immutable maxContribution;
    uint256 public immutable tokenPrice;
    uint256 public immutable totalAllocation;
    address public immutable vestingContract;
    bool public immutable refundEnabled;
    bool public immutable whitelistRequired;

    // ─────────────────────────────────────────────
    // Mutable state
    // ─────────────────────────────────────────────

    bytes32 public whitelistRoot;
    uint256 public totalRaised;
    uint256 public participantCount;
    bool public finalized;

    mapping(address => uint256) public contributions;
    mapping(address => bool) public refunded;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event ContributionReceived(address indexed user, uint256 amount, uint256 timestamp);
    event SaleFinalized(uint256 totalRaised, uint256 totalParticipants, uint256 timestamp);
    event RefundClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event SalePaused(address indexed admin, uint256 timestamp);
    event SaleUnpaused(address indexed admin, uint256 timestamp);
    event WhitelistRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 timestamp);
    event EmergencyWithdraw(address indexed by, uint256 amount, uint256 timestamp);

    // ─────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────

    error SaleNotActive();
    error SaleAlreadyFinalized();
    error SaleNotEnded();
    error HardCapExceeded();
    error ContributionOutOfRange();
    error NotWhitelisted();
    error ZeroAmount();
    error ZeroAddress();
    error SoftCapNotReached();
    error SoftCapReached();
    error RefundNotEnabled();
    error AlreadyRefunded();
    error NoContribution();
    error InvalidTimeRange();
    error InvalidCaps();

    struct SaleParams {
        uint256 projectId;
        address tokenAddress;
        address paymentToken;
        address treasury;
        uint256 startTime;
        uint256 endTime;
        uint256 softCap;
        uint256 hardCap;
        uint256 minContribution;
        uint256 maxContribution;
        uint256 tokenPrice;
        uint256 totalAllocation;
        address vestingContract;
        bool refundEnabled;
        bool whitelistRequired;
        address admin;
    }

    constructor(SaleParams memory params) {
        if (
            params.tokenAddress == address(0) ||
            params.paymentToken == address(0) ||
            params.treasury == address(0) ||
            params.admin == address(0)
        ) {
            revert ZeroAddress();
        }
        if (params.startTime >= params.endTime) revert InvalidTimeRange();
        if (params.softCap > params.hardCap) revert InvalidCaps();
        if (params.minContribution > params.maxContribution) revert InvalidCaps();

        projectId = params.projectId;
        tokenAddress = params.tokenAddress;
        paymentToken = IERC20(params.paymentToken);
        treasury = params.treasury;
        startTime = params.startTime;
        endTime = params.endTime;
        softCap = params.softCap;
        hardCap = params.hardCap;
        minContribution = params.minContribution;
        maxContribution = params.maxContribution;
        tokenPrice = params.tokenPrice;
        totalAllocation = params.totalAllocation;
        vestingContract = params.vestingContract;
        refundEnabled = params.refundEnabled;
        whitelistRequired = params.whitelistRequired;

        _grantRole(DEFAULT_ADMIN_ROLE, params.admin);
        _grantRole(ADMIN_ROLE, params.admin);
    }

    // ─────────────────────────────────────────────
    // Contribution
    // ─────────────────────────────────────────────

    function contribute(uint256 amount, bytes32[] calldata merkleProof) external nonReentrant whenNotPaused {
        if (block.timestamp < startTime || block.timestamp > endTime) revert SaleNotActive();
        if (amount == 0) revert ZeroAmount();
        if (totalRaised + amount > hardCap) revert HardCapExceeded();

        if (whitelistRequired) {
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
            if (!MerkleProof.verify(merkleProof, whitelistRoot, leaf)) revert NotWhitelisted();
        }

        uint256 newContribution = contributions[msg.sender] + amount;
        if (newContribution < minContribution || newContribution > maxContribution) {
            revert ContributionOutOfRange();
        }

        if (contributions[msg.sender] == 0) {
            participantCount += 1;
        }

        contributions[msg.sender] = newContribution;
        totalRaised += amount;

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        emit ContributionReceived(msg.sender, amount, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Refund
    // ─────────────────────────────────────────────

    function claimRefund() external nonReentrant {
        if (!refundEnabled) revert RefundNotEnabled();
        if (block.timestamp <= endTime) revert SaleNotEnded();
        if (totalRaised >= softCap) revert SoftCapReached();

        if (refunded[msg.sender]) revert AlreadyRefunded();

        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();

        refunded[msg.sender] = true;
        contributions[msg.sender] = 0;

        paymentToken.safeTransfer(msg.sender, amount);

        emit RefundClaimed(msg.sender, amount, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Finalization
    // ─────────────────────────────────────────────

    function finalizeSale() external onlyRole(ADMIN_ROLE) nonReentrant {
        if (finalized) revert SaleAlreadyFinalized();
        if (block.timestamp <= endTime) revert SaleNotEnded();
        if (totalRaised < softCap) revert SoftCapNotReached();

        finalized = true;

        paymentToken.safeTransfer(treasury, totalRaised);

        emit SaleFinalized(totalRaised, participantCount, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Admin controls
    // ─────────────────────────────────────────────

    function pauseSale() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit SalePaused(msg.sender, block.timestamp);
    }

    function unpauseSale() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit SaleUnpaused(msg.sender, block.timestamp);
    }

    function setWhitelistRoot(bytes32 merkleRoot) external onlyRole(ADMIN_ROLE) {
        bytes32 oldRoot = whitelistRoot;
        whitelistRoot = merkleRoot;
        emit WhitelistRootUpdated(oldRoot, merkleRoot, block.timestamp);
    }

    /**
     * @notice Emergency withdrawal of stuck payment tokens to the treasury only.
     *         Restricted to MULTISIG_ROLE — never the backend ADMIN_ROLE — and the
     *         destination is always the immutable treasury, so no admin can redirect funds.
     */
    function emergencyWithdraw() external onlyRole(MULTISIG_ROLE) nonReentrant {
        uint256 balance = paymentToken.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        paymentToken.safeTransfer(treasury, balance);

        emit EmergencyWithdraw(msg.sender, balance, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    function getUserContribution(address user) external view returns (uint256) {
        return contributions[user];
    }

    function getSaleStatus()
        external
        view
        returns (uint256 raised, uint256 participants, Status status)
    {
        raised = totalRaised;
        participants = participantCount;

        if (finalized) {
            status = Status.Finalized;
        } else if (block.timestamp < startTime) {
            status = Status.Pending;
        } else if (block.timestamp <= endTime) {
            status = Status.Active;
        } else {
            status = Status.Ended;
        }
    }
}
