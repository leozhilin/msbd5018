const hre = require("hardhat");

/**
 * 部署PaymentGateway合约
 * 需要先部署HKDT合约，然后将HKDT地址传入
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("==========================================");
  console.log("正在部署PaymentGateway合约...");
  console.log("部署账户:", deployer.address);
  
  // 读取HKDT合约地址
  let hkdtAddress;
  try {
    const deploymentInfo = require("../deployment-info.json");
    hkdtAddress = deploymentInfo.contractAddress;
    console.log("HKDT合约地址:", hkdtAddress);
  } catch (e) {
    console.error("❌ 错误：找不到HKDT合约地址！");
    console.error("请先运行: npm run deploy:local");
    process.exit(1);
  }
  
  // 部署PaymentGateway
  const PaymentGateway = await hre.ethers.getContractFactory("PaymentGateway");
  const paymentGateway = await PaymentGateway.deploy(hkdtAddress);
  await paymentGateway.waitForDeployment();
  const gatewayAddress = await paymentGateway.getAddress();
  
  console.log("\n✅ PaymentGateway部署成功！");
  console.log("==========================================");
  console.log("合约地址:", gatewayAddress);
  console.log("HKDT地址:", hkdtAddress);
  console.log("==========================================");
  
  // 保存部署信息
  const gatewayInfo = {
    network: hre.network.name,
    contractAddress: gatewayAddress,
    hkdtAddress: hkdtAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  require("fs").writeFileSync(
    "payment-gateway-info.json",
    JSON.stringify(gatewayInfo, null, 2)
  );
  
  console.log("\n部署信息已保存到 payment-gateway-info.json");
  console.log("\n📝 下一步：");
  console.log("1. 更新 frontend/app.js 中的 PAYMENT_GATEWAY_ADDRESS");
  console.log(`2. 设置为: "${gatewayAddress}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ 部署失败:");
    console.error(error);
    process.exit(1);
  });

