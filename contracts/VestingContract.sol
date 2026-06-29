// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title VestingContract
 * @notice Manages post-sale token vesting with TGE unlock, cliff, and linear interval release.
 */
contract VestingContract is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable token;

    struct VestingSchedule {
        uint256 totalAllocation;   // total tokens allocated to this beneficiary
        uint256 tgeAmount;         // tokens unlocked at TGE
        uint256 cliffEnd;          // timestamp when cliff ends
        uint256 vestingStart;      // timestamp when linear vesting begins (= cliffEnd)
        uint256 vestingEnd;        // timestamp when vesting fully completes
        uint256 vestingInterval;   // seconds between each vesting release
        uint256 claimed;           // tokens already claimed
        bool initialized;
    }

    mapping(address => VestingSchedule) private schedules;

    // Global vesting parameters set at deployment
    uint256 public tgePercent;       // e.g. 10 means 10%
    uint256 public cliffDuration;    // seconds
    uint256 public vestingDuration;  // seconds
    uint256 public vestingInterval;  // seconds
    uint256 public vestingStartDate; // TGE timestamp

    bool public allocationsLocked;

    event AllocationSet(address indexed beneficiary, uint256 totalAllocation);
    event TokensClaimed(address indexed beneficiary, uint256 amount, uint256 timestamp);
    event AllocationsLocked(uint256 timestamp);

    error AllocationsAlreadyLocked();
    error VestingNotStarted();
    error NothingToClaim();
    error ZeroAddress();
    error ZeroAmount();
    error AllocationAlreadySet();
    error ArrayLengthMismatch();
    error VestingStartDateNotSet();

    constructor(
        address _token,
        address _admin,
        uint256 _tgePercent,
        uint256 _cliffDuration,
        uint256 _vestingDuration,
        uint256 _vestingInterval,
        uint256 _vestingStartDate
    ) {
        if (_token == address(0) || _admin == address(0)) revert ZeroAddress();
        require(_tgePercent <= 100, "TGE percent exceeds 100");
        require(_vestingInterval > 0, "Interval must be > 0");
        require(_vestingDuration >= _vestingInterval, "Duration < interval");

        token = IERC20(_token);
        tgePercent = _tgePercent;
        cliffDuration = _cliffDuration;
        vestingDuration = _vestingDuration;
        vestingInterval = _vestingInterval;
        vestingStartDate = _vestingStartDate;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    // ─────────────────────────────────────────────
    // Admin functions
    // ─────────────────────────────────────────────

    /**
     * @notice Batch-set investor allocations before vesting begins.
     */
    function setAllocations(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyRole(ADMIN_ROLE) {
        if (allocationsLocked) revert AllocationsAlreadyLocked();
        if (users.length != amounts.length) revert ArrayLengthMismatch();

        uint256 cliffEnd = vestingStartDate + cliffDuration;

        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();

            uint256 tgeAmt = (amounts[i] * tgePercent) / 100;
            uint256 remaining = amounts[i] - tgeAmt;

            schedules[users[i]] = VestingSchedule({
                totalAllocation: amounts[i],
                tgeAmount: tgeAmt,
                cliffEnd: cliffEnd,
                vestingStart: cliffEnd,
                vestingEnd: cliffEnd + vestingDuration,
                vestingInterval: vestingInterval,
                claimed: 0,
                initialized: true
            });

            emit AllocationSet(users[i], amounts[i]);

            // suppress unused variable warning
            remaining;
        }
    }

    /**
     * @notice Lock allocations so no further changes can be made.
     */
    function lockAllocations() external onlyRole(ADMIN_ROLE) {
        allocationsLocked = true;
        emit AllocationsLocked(block.timestamp);
    }

    function pauseVesting() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpauseVesting() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ─────────────────────────────────────────────
    // Investor functions
    // ─────────────────────────────────────────────

    /**
     * @notice Claim all currently unlocked tokens.
     */
    function claim() external nonReentrant whenNotPaused {
        if (vestingStartDate == 0) revert VestingStartDateNotSet();
        if (block.timestamp < vestingStartDate) revert VestingNotStarted();

        uint256 claimable = claimableAmount(msg.sender);
        if (claimable == 0) revert NothingToClaim();

        schedules[msg.sender].claimed += claimable;
        token.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────

    /**
     * @notice Returns tokens available to claim right now.
     */
    function claimableAmount(address user) public view returns (uint256) {
        return vestedAmount(user) - schedules[user].claimed;
    }

    /**
     * @notice Returns total tokens vested to date (including already claimed).
     */
    function vestedAmount(address user) public view returns (uint256) {
        VestingSchedule storage s = schedules[user];
        if (!s.initialized) return 0;
        if (block.timestamp < vestingStartDate) return 0;

        // TGE unlock is available immediately at vestingStartDate
        uint256 vested = s.tgeAmount;

        // Nothing more until cliff ends
        if (block.timestamp < s.cliffEnd) return vested;

        uint256 postCliffAllocation = s.totalAllocation - s.tgeAmount;

        if (block.timestamp >= s.vestingEnd) {
            vested += postCliffAllocation;
        } else {
            // How many complete intervals have passed since vesting start
            uint256 elapsed = block.timestamp - s.vestingStart;
            uint256 intervals = elapsed / s.vestingInterval;
            uint256 totalIntervals = vestingDuration / s.vestingInterval;
            vested += (postCliffAllocation * intervals) / totalIntervals;
        }

        return vested;
    }

    /**
     * @notice Returns the full vesting schedule for a user.
     */
    function getVestingSchedule(address user)
        external
        view
        returns (VestingSchedule memory)
    {
        return schedules[user];
    }
}
