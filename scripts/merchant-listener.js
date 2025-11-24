const hre = require("hardhat");

/**
 * 商户后台监听脚本
 * 监听链上的PaymentReceived事件，显示支付通知
 * 
 * 使用方法：
 *   1. 确保 hardhat node 正在运行
 *   2. 确保 PaymentGateway 已部署
 *   3. 运行: node scripts/merchant-listener.js
 */
async function main() {
  console.log("==========================================");
  console.log("商户支付监听服务启动");
  console.log("==========================================\n");
  
  // 读取PaymentGateway地址
  let gatewayAddress;
  try {
    const gatewayInfo = require("../payment-gateway-info.json");
    gatewayAddress = gatewayInfo.contractAddress;
    console.log("PaymentGateway地址:", gatewayAddress);
  } catch (e) {
    console.error("❌ 错误：找不到PaymentGateway地址！");
    console.error("请先运行: node scripts/deploy-payment-gateway.js");
    process.exit(1);
  }
  
  // 连接合约
  const PaymentGateway = await hre.ethers.getContractFactory("PaymentGateway");
  const paymentGateway = PaymentGateway.attach(gatewayAddress);
  
  // 获取provider
  const provider = hre.ethers.provider;
  
  console.log("✅ 监听服务已启动，等待支付事件...\n");
  console.log("提示：当有用户支付时，会在这里显示通知\n");
  
  // 监听PaymentReceived事件
  paymentGateway.on("PaymentReceived", (payer, merchant, orderId, amount, token, event) => {
    console.log("==========================================");
    console.log("💰 收到新支付！");
    console.log("==========================================");
    console.log("订单ID:", orderId);
    console.log("付款人:", payer);
    console.log("商户地址:", merchant);
    console.log("支付金额:", hre.ethers.formatEther(amount), "HKDT");
    console.log("代币地址:", token);
    console.log("交易哈希:", event.transactionHash);
    console.log("区块号:", event.blockNumber);
    console.log("时间:", new Date().toLocaleString('zh-CN'));
    console.log("==========================================\n");
    
    // 这里可以添加：
    // - 发送邮件通知
    // - 更新数据库
    // - 调用API
    // - 发送Telegram消息等
  });
  
  // 保持脚本运行
  console.log("监听中... (按 Ctrl+C 停止)");
}

main().catch((error) => {
  console.error("\n❌ 监听服务错误:");
  console.error(error);
  process.exit(1);
});

