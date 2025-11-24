const hre = require("hardhat");

async function main() {
  const targetAddress = "0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097";
  const amount = "1000";
  
  // 读取HKDT合约地址
  const deploymentInfo = require("../deployment-info.json");
  const hkdtAddress = deploymentInfo.contractAddress;
  
  console.log("==========================================");
  console.log("给账户铸币");
  console.log("==========================================");
  console.log("目标地址:", targetAddress);
  console.log("铸币数量:", amount, "HKDT");
  console.log("HKDT合约:", hkdtAddress);
  console.log("");
  
  // 获取账户
  const [owner] = await hre.ethers.getSigners();
  console.log("Owner地址:", owner.address);
  
  // 连接合约
  const HKDT = await hre.ethers.getContractFactory("HKDT");
  const hkdt = await HKDT.attach(hkdtAddress);
  
  // 转换数量
  const amountWei = hre.ethers.parseUnits(amount, 18);
  
  // 执行铸币
  console.log("\n正在铸币...");
  const tx = await hkdt.connect(owner).mint(targetAddress, amountWei);
  console.log("交易哈希:", tx.hash);
  await tx.wait();
  
  // 检查余额
  const balanceAfter = await hkdt.balanceOf(targetAddress);
  console.log("铸币后余额:", hre.ethers.formatEther(balanceAfter), "HKDT");
  
  console.log("\n✅ 铸币成功！");
  console.log("==========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ 铸币失败:");
    console.error(error);
    process.exit(1);
  });

