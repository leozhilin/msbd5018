const hre = require("hardhat");

/**
 * 部署HKDT合约到指定网络
 * 使用方法：
 *   npx hardhat run scripts/deploy.js --network hardhat        (本地网络)
 *   npx hardhat run scripts/deploy.js --network sepolia        (Sepolia测试网)
 *   npx hardhat run scripts/deploy.js --network mumbai         (Polygon Mumbai测试网)
 */
async function main() {
  // 获取部署账户（默认是第一个账户）
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("==========================================");
  console.log("正在部署HKDT合约...");
  console.log("部署账户地址:", deployer.address);
  
  // 检查账户余额（仅测试网）
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance === 0n && hre.network.name !== "hardhat") {
    console.error("❌ 错误：账户余额不足，无法支付gas费用！");
    console.log("请前往测试网水龙头获取测试币：");
    console.log("  - Sepolia: https://sepoliafaucet.com/");
    console.log("  - Mumbai: https://faucet.polygon.technology/");
    process.exit(1);
  }

  // 获取合约工厂
  const HKDT = await hre.ethers.getContractFactory("HKDT");
  
  // 部署合约
  console.log("\n正在部署合约...");
  const hkdt = await HKDT.deploy();
  
  // 等待合约部署完成
  await hkdt.waitForDeployment();
  const contractAddress = await hkdt.getAddress();
  
  console.log("\n✅ 部署成功！");
  console.log("==========================================");
  console.log("合约地址:", contractAddress);
  console.log("网络:", hre.network.name);
  console.log("代币名称:", await hkdt.name());
  console.log("代币符号:", await hkdt.symbol());
  console.log("Owner地址:", await hkdt.owner());
  console.log("==========================================");
  
  // 如果是测试网，输出验证信息
  if (hre.network.name !== "hardhat") {
    console.log("\n📝 下一步：");
    console.log("1. 在浏览器中查看合约:");
    if (hre.network.name === "sepolia") {
      console.log(`   https://sepolia.etherscan.io/address/${contractAddress}`);
    } else if (hre.network.name === "mumbai") {
      console.log(`   https://mumbai.polygonscan.com/address/${contractAddress}`);
    }
    console.log("2. 使用Remix IDE与合约交互");
    console.log("3. 在前端应用中连接此合约地址");
  }
  
  // 保存部署信息（可选）
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  console.log("\n部署信息已保存到 deployment-info.json");
  require("fs").writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
}

// 执行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ 部署失败:");
    console.error(error);
    process.exit(1);
  });


