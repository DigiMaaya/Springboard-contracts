// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ProjectSale.sol";

/**
 * @title SpringboardFactory
 * @notice Master contract controlled by Springboard. Deploys, registers, and manages
 *         all ProjectSale contracts from a single controlled system.
 * @dev Sales are deployed directly (`new ProjectSale(...)`) rather than via minimal
 *      proxy clones, since ProjectSale relies on immutable constructor-set config per
 *      sale. `implementation` / `setImplementation` are kept as a reserved slot should
 *      a clone-based upgrade path be adopted later; they do not currently affect
 *      deployment.
 */
contract SpringboardFactory is AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct CreateSaleParams {
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
    }

    mapping(uint256 => address) public sales;
    address[] public allSales;

    address public implementation;

    event SaleCreated(
        uint256 indexed projectId,
        address indexed saleAddress,
        address indexed tokenAddress,
        address paymentToken,
        uint256 timestamp
    );
    event FactoryPaused(address indexed admin, uint256 timestamp);
    event FactoryUnpaused(address indexed admin, uint256 timestamp);
    event ImplementationUpdated(address indexed oldImplementation, address indexed newImplementation, uint256 timestamp);
    event FactoryAdminTransferred(address indexed oldAdmin, address indexed newAdmin, uint256 timestamp);

    error SaleAlreadyExists();
    error ZeroAddress();

    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /**
     * @notice Deploys a new ProjectSale contract and registers it by project ID.
     */
    function createSale(CreateSaleParams calldata params)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        returns (address saleAddress)
    {
        if (sales[params.projectId] != address(0)) revert SaleAlreadyExists();

        ProjectSale.SaleParams memory saleParams = ProjectSale.SaleParams({
            projectId: params.projectId,
            tokenAddress: params.tokenAddress,
            paymentToken: params.paymentToken,
            treasury: params.treasury,
            startTime: params.startTime,
            endTime: params.endTime,
            softCap: params.softCap,
            hardCap: params.hardCap,
            minContribution: params.minContribution,
            maxContribution: params.maxContribution,
            tokenPrice: params.tokenPrice,
            totalAllocation: params.totalAllocation,
            vestingContract: params.vestingContract,
            refundEnabled: params.refundEnabled,
            whitelistRequired: params.whitelistRequired,
            admin: msg.sender
        });

        ProjectSale sale = new ProjectSale(saleParams);
        saleAddress = address(sale);

        sales[params.projectId] = saleAddress;
        allSales.push(saleAddress);

        emit SaleCreated(params.projectId, saleAddress, params.tokenAddress, params.paymentToken, block.timestamp);
    }

    /**
     * @notice Returns the sale contract address for a given project ID.
     */
    function getSale(uint256 projectId) external view returns (address) {
        return sales[projectId];
    }

    /**
     * @notice Returns all registered sale contract addresses.
     */
    function getAllSales() external view returns (address[] memory) {
        return allSales;
    }

    /**
     * @notice Pauses new sale deployments.
     */
    function pauseFactory() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit FactoryPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Resumes new sale deployments.
     */
    function unpauseFactory() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit FactoryUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Reserved for a future clone-based upgrade path. Currently informational only;
     *         createSale always deploys a fresh ProjectSale and does not read this value.
     */
    function setImplementation(address newImplementation) external onlyRole(ADMIN_ROLE) {
        address oldImplementation = implementation;
        implementation = newImplementation;
        emit ImplementationUpdated(oldImplementation, newImplementation, block.timestamp);
    }

    /**
     * @notice Transfers factory admin (DEFAULT_ADMIN_ROLE + ADMIN_ROLE) to a new address.
     */
    function transferFactoryAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newAdmin == address(0)) revert ZeroAddress();

        address oldAdmin = msg.sender;

        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        _grantRole(ADMIN_ROLE, newAdmin);
        _revokeRole(ADMIN_ROLE, oldAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, oldAdmin);

        emit FactoryAdminTransferred(oldAdmin, newAdmin, block.timestamp);
    }
}
