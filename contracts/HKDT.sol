// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title HKDT - Minimal HKD-pegged ERC20 for demo (mint/burn by owner)
/// @notice 这是一个最小可演示版本的稳定币合约，支持铸币和赎回功能
contract HKDT is ERC20, Ownable, Pausable {
    /// @notice 铸币事件：当owner给用户铸造HKDT时触发
    /// @param to 接收HKDT的地址
    /// @param amount 铸造的数量（以wei为单位，18位小数）
    event Minted(address indexed to, uint256 amount);

    /// @notice 赎回事件：当用户销毁HKDT赎回法币时触发
    /// @param from 赎回用户的地址
    /// @param amount 赎回的数量
    /// @param bankRef 银行交易参考号，用于链下退款识别
    event Redeemed(address indexed from, uint256 amount, string bankRef);

    /// @notice 构造函数：初始化代币名称和符号
    /// @dev 继承ERC20合约，设置代币名称为"HongKong Dollar Token"，符号为"HKDT"
    constructor() ERC20("HongKong Dollar Token", "HKDT") Ownable(msg.sender) {}

    /// @notice 铸币函数：只有owner可以调用，给指定地址铸造HKDT
    /// @dev 在链下验证用户已存入港币后，由后端调用此函数铸造等额HKDT
    /// @param to 接收HKDT的地址
    /// @param amount 要铸造的数量（以wei为单位，例如1 HKDT = 1e18 wei）
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        require(to != address(0), "HKDT: cannot mint to zero address");
        require(amount > 0, "HKDT: amount must be greater than 0");
        
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// @notice 赎回函数：用户销毁HKDT，触发链下退款流程
    /// @dev 用户调用此函数销毁自己的HKDT，合约发出Redeemed事件
    ///      后端监听此事件，执行法币转账到用户银行账户
    /// @param amount 要赎回的数量
    /// @param bankRef 银行交易参考号，用于后端识别和记录退款
    function redeem(uint256 amount, string calldata bankRef) external whenNotPaused {
        require(amount > 0, "HKDT: amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "HKDT: insufficient balance");
        require(bytes(bankRef).length > 0, "HKDT: bankRef cannot be empty");
        
        _burn(msg.sender, amount);
        emit Redeemed(msg.sender, amount, bankRef);
        
        // 注意：实际的港币退款由链下后端服务处理
        // 后端监听Redeemed事件，然后执行银行转账
    }

    /// @notice 暂停合约：紧急情况下停止所有转账和铸币/赎回操作
    /// @dev 只有owner可以调用，用于应对安全事件或系统维护
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice 恢复合约：解除暂停状态，恢复正常操作
    /// @dev 只有owner可以调用
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice 内部钩子函数：在每次代币转账前检查合约是否暂停
    /// @dev 覆写ERC20的_beforeTokenTransfer，确保暂停时所有转账、铸币、销毁都被阻止
    /// @param from 发送方地址（铸币时为address(0)）
    /// @param to 接收方地址（销毁时为address(0)）
    /// @param amount 转账数量
    function _update(address from, address to, uint256 amount)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, amount);
    }
}


