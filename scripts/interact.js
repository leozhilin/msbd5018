const hre = require("hardhat");

/**
 * 本地网络交互脚本
 * 演示如何使用HKDT合约进行铸币、转账、赎回等操作
 * 
 * 使用方法：
 *   1. 先运行: npx hardhat node (在另一个终端)
 *   2. 部署合约: npm run deploy:local
 *   3. 修改下面的 contractAddress 为实际部署地址
 *   4. 运行: npx hardhat run scripts/interact.js --network hardhat
 */
async function main() {
  console.log("==========================================");
  console.log("HKDT 合约交互演示");
  console.log("==========================================\n");

  // 获取账户
  const [owner, user1, user2] = await hre.ethers.getSigners();
  
  console.log("账户信息：");
  console.log("  Owner:", owner.address);
  console.log("  User1:", user1.address);
  console.log("  User2:", user2.address);
  console.log("");

  // 从部署信息文件读取合约地址，如果没有则使用默认地址
  let contractAddress;
  try {
    const deploymentInfo = require("../deployment-info.json");
    contractAddress = deploymentInfo.contractAddress;
    console.log("从 deployment-info.json 读取合约地址:", contractAddress);
  } catch (e) {
    // 如果没有部署信息文件，使用默认地址（Hardhat本地网络通常使用这个地址）
    contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    console.log("使用默认合约地址:", contractAddress);
    console.log("提示：如果合约地址不对，请先运行 npm run deploy:local");
  }

  // 获取合约实例
  const HKDT = await hre.ethers.getContractFactory("HKDT");
  const hkdt = await HKDT.attach(contractAddress);

  // 检查合约是否存在（检查该地址是否有代码）
  const code = await hre.ethers.provider.getCode(contractAddress);
  if (code === "0x" || code === "0x0") {
    console.error("\n❌ 错误：该地址上没有合约代码！");
    console.error(`   合约地址: ${contractAddress}`);
    console.error("\n可能的原因：");
    console.error("  1. 本地网络已重置（hardhat node 重启了）");
    console.error("  2. 合约尚未部署");
    console.error("\n解决方案：");
    console.error("  1. 确保 'npm run node' 正在运行");
    console.error("  2. 在另一个终端运行: npm run deploy:local");
    console.error("  3. 然后重新运行此脚本");
    process.exit(1);
  }

  // 检查合约是否正确连接
  let name, symbol;
  try {
    name = await hkdt.name();
    symbol = await hkdt.symbol();
    console.log(`\n✅ 已连接到合约: ${name} (${symbol})\n`);
  } catch (error) {
    console.error("\n❌ 无法连接到合约！");
    console.error("错误信息:", error.message);
    console.error("\n请确保：");
    console.error("  1. 'npm run node' 正在运行");
    console.error("  2. 合约已部署（运行 npm run deploy:local）");
    process.exit(1);
  }

  // ========== 演示1: 铸币 ==========
  console.log("【演示1】Owner给User1铸币100 HKDT");
  console.log("----------------------------------------");
  const mintAmount = hre.ethers.parseUnits("100", 18);
  
  const tx1 = await hkdt.connect(owner).mint(user1.address, mintAmount);
  await tx1.wait();
  
  const balance1 = await hkdt.balanceOf(user1.address);
  const totalSupply1 = await hkdt.totalSupply();
  
  console.log("✅ 铸币成功！");
  console.log(`   User1余额: ${hre.ethers.formatEther(balance1)} HKDT`);
  console.log(`   总供应量: ${hre.ethers.formatEther(totalSupply1)} HKDT`);
  console.log("");

  // ========== 演示2: 转账 ==========
  console.log("【演示2】User1转账50 HKDT给User2");
  console.log("----------------------------------------");
  const transferAmount = hre.ethers.parseUnits("50", 18);
  
  const tx2 = await hkdt.connect(user1).transfer(user2.address, transferAmount);
  await tx2.wait();
  
  const balance1_after = await hkdt.balanceOf(user1.address);
  const balance2_after = await hkdt.balanceOf(user2.address);
  
  console.log("✅ 转账成功！");
  console.log(`   User1余额: ${hre.ethers.formatEther(balance1_after)} HKDT`);
  console.log(`   User2余额: ${hre.ethers.formatEther(balance2_after)} HKDT`);
  console.log("");

  // ========== 演示3: 赎回 ==========
  console.log("【演示3】User1赎回30 HKDT");
  console.log("----------------------------------------");
  const redeemAmount = hre.ethers.parseUnits("30", 18);
  
  const tx3 = await hkdt.connect(user1).redeem(redeemAmount, "bank-ref-001");
  await tx3.wait();
  
  const balance1_final = await hkdt.balanceOf(user1.address);
  const totalSupply_final = await hkdt.totalSupply();
  
  console.log("✅ 赎回成功！");
  console.log(`   User1余额: ${hre.ethers.formatEther(balance1_final)} HKDT`);
  console.log(`   总供应量: ${hre.ethers.formatEther(totalSupply_final)} HKDT`);
  console.log("   注意：实际港币退款由链下后端处理");
  console.log("");

  // ========== 演示4: 给User2也铸币 ==========
  console.log("【演示4】Owner给User2铸币200 HKDT");
  console.log("----------------------------------------");
  const mintAmount2 = hre.ethers.parseUnits("200", 18);
  
  const tx4 = await hkdt.connect(owner).mint(user2.address, mintAmount2);
  await tx4.wait();
  
  const balance2_final = await hkdt.balanceOf(user2.address);
  const totalSupply_final2 = await hkdt.totalSupply();
  
  console.log("✅ 铸币成功！");
  console.log(`   User2余额: ${hre.ethers.formatEther(balance2_final)} HKDT`);
  console.log(`   总供应量: ${hre.ethers.formatEther(totalSupply_final2)} HKDT`);
  console.log("");

  // ========== 最终状态 ==========
  console.log("==========================================");
  console.log("最终状态汇总");
  console.log("==========================================");
  console.log(`User1余额: ${hre.ethers.formatEther(await hkdt.balanceOf(user1.address))} HKDT`);
  console.log(`User2余额: ${hre.ethers.formatEther(await hkdt.balanceOf(user2.address))} HKDT`);
  console.log(`总供应量: ${hre.ethers.formatEther(await hkdt.totalSupply())} HKDT`);
  console.log(`合约Owner: ${await hkdt.owner()}`);
  console.log(`合约状态: ${await hkdt.paused() ? "已暂停" : "正常运行"}`);
  console.log("==========================================\n");

  console.log("🎉 演示完成！");
  console.log("\n提示：");
  console.log("  - 所有操作都在本地网络完成");
  console.log("  - 可以随时重置网络重新开始");
  console.log("  - 适合课程演示和开发测试");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ 执行失败:");
    console.error(error);
    process.exit(1);
  });


