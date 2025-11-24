// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PaymentGateway - 支付网关合约
/// @notice 处理HKDT支付，记录订单信息，触发支付事件
contract PaymentGateway is Ownable {
    /// @notice 支付事件：当用户成功支付时触发
    /// @param payer 付款人地址
    /// @param merchant 商户地址
    /// @param orderId 订单ID
    /// @param amount 支付金额
    /// @param token 代币地址（HKDT）
    event PaymentReceived(
        address indexed payer,
        address indexed merchant,
        string indexed orderId,
        uint256 amount,
        address token
    );

    /// @notice 订单状态
    enum OrderStatus {
        Pending,    // 待支付
        Paid,       // 已支付
        Refunded    // 已退款
    }

    /// @notice 订单信息
    struct Order {
        address payer;           // 付款人
        address merchant;        // 商户
        uint256 amount;          // 金额
        address token;          // 代币地址
        OrderStatus status;      // 状态
        uint256 timestamp;       // 时间戳
    }

    /// @notice 订单映射：orderId => Order
    mapping(string => Order) public orders;

    /// @notice HKDT代币地址
    IERC20 public hkdtToken;

    constructor(address _hkdtToken) Ownable(msg.sender) {
        hkdtToken = IERC20(_hkdtToken);
    }

    /// @notice 支付函数：用户使用HKDT支付订单
    /// @param merchant 商户地址
    /// @param orderId 订单ID（唯一标识）
    /// @param amount 支付金额（以wei为单位）
    function pay(
        address merchant,
        string calldata orderId,
        uint256 amount
    ) external {
        require(merchant != address(0), "PaymentGateway: invalid merchant");
        require(amount > 0, "PaymentGateway: amount must be greater than 0");
        require(bytes(orderId).length > 0, "PaymentGateway: orderId cannot be empty");
        require(orders[orderId].timestamp == 0, "PaymentGateway: orderId already exists");

        // 检查用户HKDT余额
        require(
            hkdtToken.balanceOf(msg.sender) >= amount,
            "PaymentGateway: insufficient balance"
        );

        // 从用户转账到商户
        require(
            hkdtToken.transferFrom(msg.sender, merchant, amount),
            "PaymentGateway: transfer failed"
        );

        // 记录订单
        orders[orderId] = Order({
            payer: msg.sender,
            merchant: merchant,
            amount: amount,
            token: address(hkdtToken),
            status: OrderStatus.Paid,
            timestamp: block.timestamp
        });

        // 触发支付事件
        emit PaymentReceived(
            msg.sender,
            merchant,
            orderId,
            amount,
            address(hkdtToken)
        );
    }

    /// @notice 查询订单信息
    /// @param orderId 订单ID
    /// @return Order 订单信息
    function getOrder(string calldata orderId) external view returns (Order memory) {
        require(orders[orderId].timestamp != 0, "PaymentGateway: order not found");
        return orders[orderId];
    }

    /// @notice 检查订单是否已支付
    /// @param orderId 订单ID
    /// @return bool 是否已支付
    function isPaid(string calldata orderId) external view returns (bool) {
        return orders[orderId].status == OrderStatus.Paid;
    }
}

