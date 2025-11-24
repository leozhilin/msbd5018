# HKDT 稳定币项目

一个完整的去中心化稳定币支付系统，包含稳定币发行、支付网关和前端演示。

## 📋 项目简介

HKDT (HongKong Dollar Token) 是一个1:1锚定港币的稳定币项目，支持：
- ✅ 稳定币铸造（Mint）
- ✅ 稳定币赎回（Redeem/Burn）
- ✅ 支付网关（PaymentGateway）
- ✅ 前端支付演示
- ✅ 商户后台监听

## 🚀 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm 或 yarn
- MetaMask 浏览器扩展

### 完整流程

#### 1. 安装依赖

```bash
npm install
```

#### 2. 编译合约

```bash
npm run compile
```

#### 3. 运行测试（可选）

```bash
npm test
```

#### 4. 启动本地网络

**打开终端1**，运行：

```bash
npm run node
```

**重要**：保持这个终端窗口打开！你会看到：
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
```

#### 5. 部署合约

**打开终端2**（新窗口），运行：

```bash
# 部署HKDT合约
npm run deploy:local

# 部署PaymentGateway合约
npm run deploy:gateway
```

#### 6. 启动前端

**在终端2**，**确保在项目根目录**（不是frontend目录），运行：

```bash
# 方法1：使用Python（推荐）
python -m http.server 8000

# 方法2：使用Node.js http-server
npx http-server -p 8000
```

然后访问：**http://localhost:8000/frontend/**

**重要**：
- ✅ 从**项目根目录**启动服务器（不是frontend目录）
- ✅ 访问地址是 `http://localhost:8000/frontend/`（不是根路径）
- ✅ 这样前端可以自动读取根目录的JSON文件

#### 7. 访问前端

打开浏览器访问：http://localhost:8000

#### 8. 连接钱包并测试

1. 点击"连接钱包"按钮
2. 在MetaMask中确认连接
3. 确保MetaMask连接到本地网络（Chain ID: 1337）
   - 如果网络不存在，前端会自动添加
   - 或手动添加：网络名称 `Hardhat Local`，RPC URL `http://127.0.0.1:8545`，Chain ID `1337`
4. 如果余额为0，需要先铸币（见下方）

#### 9. 给账户铸币（如果需要）

如果MetaMask账户的HKDT余额为0，运行：

```bash
# 编辑 scripts/mint-simple.js，修改目标地址
# 然后运行：
npx hardhat run scripts/mint-simple.js --network localhost
```

#### 10. 启动商户监听（可选）

**打开终端3**，运行：

```bash
npm run merchant
```

当有用户支付时，这个终端会显示支付通知。

## 📁 项目结构

```
hkdt/
├── contracts/              # 智能合约
│   ├── HKDT.sol           # HKDT稳定币合约
│   └── PaymentGateway.sol   # 支付网关合约
├── scripts/                 # 部署和工具脚本
│   ├── deploy.js            # 部署HKDT合约
│   ├── deploy-payment-gateway.js  # 部署PaymentGateway
│   ├── interact.js          # 交互演示脚本
│   ├── merchant-listener.js # 商户监听脚本
│   └── mint-simple.js       # 给指定地址铸币
├── test/                    # 测试文件
│   └── hkdt-test.js         # HKDT合约测试
├── frontend/                # 前端页面
│   ├── index.html           # 前端HTML
│   └── app.js               # 前端JavaScript（自动读取合约地址）
├── hardhat.config.js        # Hardhat配置
├── package.json             # 项目配置
└── README.md                # 项目说明
```

## 🔧 核心功能

### HKDT 稳定币合约

- **铸币 (Mint)**：只有owner可以给用户铸造HKDT
- **赎回 (Redeem)**：用户可以销毁HKDT，触发链下退款流程
- **暂停/恢复**：紧急情况下可以暂停所有操作

### PaymentGateway 支付网关

- **支付功能**：用户使用HKDT支付订单
- **订单管理**：记录订单信息和状态
- **事件通知**：触发PaymentReceived事件供商户监听

### 前端支付演示

- **钱包连接**：自动连接MetaMask
- **余额显示**：实时显示HKDT余额
- **支付功能**：支持通过PaymentGateway支付
- **订单历史**：显示最近支付记录
- **自动配置**：自动读取部署信息，无需手动配置

## 📝 常用命令

| 命令 | 说明 | 在哪个终端 |
|------|------|-----------|
| `npm run node` | 启动本地网络 | 终端1（保持运行） |
| `npm run deploy:local` | 部署HKDT合约 | 终端2 |
| `npm run deploy:gateway` | 部署PaymentGateway | 终端2 |
| `npm run interact` | 交互演示 | 终端2 |
| `npm run merchant` | 商户监听 | 终端3 |
| `npm test` | 运行测试 | 任意终端 |
| `npm run compile` | 编译合约 | 任意终端 |

## 🔄 重启流程

如果重启了 `hardhat node`，需要：

1. **重新部署合约**
   ```bash
   npm run deploy:local
   npm run deploy:gateway
   ```

2. **刷新前端页面**
   - 前端会自动读取最新的合约地址
   - 无需手动修改代码

3. **重新铸币**（如果需要）
   ```bash
   npx hardhat run scripts/mint-simple.js --network localhost
   ```

## ⚠️ 重要提示

1. **保持 hardhat node 运行**
   - 关闭 `npm run node` 的终端 = 网络停止 = 需要重新部署

2. **MetaMask 网络配置**
   - 必须连接到本地网络（Chain ID: 1337）
   - 使用测试ETH（hardhat node自动分配），不是真实ETH

3. **账户余额**
   - hardhat node 的20个测试账户每个都有10000 ETH（测试币）
   - 可以在MetaMask中导入这些账户的私钥
   - 或者给当前账户转账测试ETH

4. **合约地址**
   - 每次重新部署，合约地址会变化
   - 前端会自动读取，无需手动修改

## 🎯 演示流程

1. 启动本地网络 → `npm run node`
2. 部署合约 → `npm run deploy:local` + `npm run deploy:gateway`
3. 启动前端 → `cd frontend && python -m http.server 8000`
4. 连接钱包 → 在浏览器中点击"连接钱包"
5. 给账户铸币 → `npx hardhat run scripts/mint-simple.js --network localhost`
6. 测试支付 → 在前端输入商户地址和金额，点击支付
7. 查看通知 → 商户监听终端会显示支付通知

## 📚 技术栈

- **智能合约**：Solidity 0.8.20
- **开发框架**：Hardhat
- **合约库**：OpenZeppelin
- **前端**：原生JavaScript + ethers.js
- **钱包**：MetaMask

## 🔗 相关资源

- [Hardhat文档](https://hardhat.org/docs)
- [OpenZeppelin合约库](https://docs.openzeppelin.com/contracts)
- [Ethers.js文档](https://docs.ethers.org/)
- [MetaMask文档](https://docs.metamask.io/)

## 📄 许可证

MIT License

---

## 🧪 储备管理策略对比实验

本项目包含一个动态储备管理策略的对比实验，用于评估固定储备策略与基于VaR（风险价值）的动态优化策略的效果。

### 实验目标

对比两种储备管理策略在收益和流动性风险方面的表现：
- **固定储备方案**：L1(20%) + L2(70%) + L3(10%)，固定比例
- **VaR动态优化方案**：根据历史赎回数据动态调整L1/L2/L3比例，满足VaR约束并最大化收益

### 实验设置

#### 储备层级定义

- **L1（现金储备）**：0%收益，随时可用，用于日常赎回
- **L2（短期投资）**：年化3%收益，可快速变现（1-7天），作为缓冲层
- **L3（长期投资）**：年化5%收益，变现较慢，提供主要收益

#### 实验参数

- **初始储备**：1亿 HKD
- **历史数据**：100天赎回数据（用于计算VaR）
- **测试周期**：90天未来数据
- **VaR置信度**：95%
- **重平衡频率**：VaR策略每周重平衡一次

#### 评估指标

1. **年化收益率**：策略的年化收益（绝对值和百分比）
2. **流动性不足次数**：L1不足需要补充的次数
   - 从L2补充次数：代价较小
   - 从L3补充次数：代价较大（应尽量避免）
3. **最大流动性缺口**：单次最大缺口金额
4. **LCR合规率**：L1满足VaR(7天)要求的天数占比
5. **风险调整收益**：年化收益 / 流动性不足次数

### 如何运行实验

在项目根目录运行：

```bash
npm run reserve:compare
```

实验会自动：
1. 生成100天历史赎回数据（用于训练VaR模型）
2. 生成90天未来测试数据（包含波动和突发高峰）
3. 运行两种策略的模拟
4. 输出对比结果

### 实验结果

#### 实验数据（示例运行）

```
📊 计算VaR...
  VaR(7天, 95%): 1777万 HKD
  VaR(30天, 95%): 7614万 HKD

🎯 VaR策略初始配置:
  L1: 1777万 HKD (17.8%)
  L2: 5838万 HKD (58.4%)
  L3: 2386万 HKD (23.9%)
```

#### 策略对比结果

**固定储备方案：**
- 年化收益率：373万 HKD (3.73%)
- 流动性不足次数：80次
  - 从L2补充：78次（总金额20417万 HKD）
  - 从L3补充：2次（总金额366万 HKD）
- 最大流动性缺口：1000万 HKD
- LCR合规率：2.22%
- 风险调整收益：5万 HKD

**VaR动态优化方案：**
- 年化收益率：303万 HKD (3.03%)
- 流动性不足次数：5次
  - 从L2补充：5次（总金额759万 HKD）
  - 从L3补充：0次（总金额0万 HKD）
- 最大流动性缺口：259万 HKD
- LCR合规率：11.11%
- 风险调整收益：61万 HKD

#### 对比分析

| 指标 | 固定方案 | VaR方案 | 改进 |
|------|---------|---------|------|
| 年化收益率 | 3.73% | 3.03% | -0.70% ❌ |
| 流动性不足次数 | 80次 | 5次 | -75次 ✅ |
| 从L2补充次数 | 78次 | 5次 | -73次 ✅ |
| 从L3补充次数 | 2次 | 0次 | -2次 ✅ |
| LCR合规率 | 2.22% | 11.11% | +8.89% ✅ |
| 最大流动性缺口 | 1000万 | 259万 | -741万 ✅ |
| 风险调整收益 | 5万 | 61万 | +56万 ✅ |

### 实验结论

1. **流动性风险管理**：
   - VaR策略显著减少了流动性不足次数（从80次降至5次）
   - 完全避免了从L3补充的情况（固定方案有2次）
   - 最大流动性缺口大幅降低（从1000万降至259万）

2. **收益权衡**：
   - VaR策略收益率略低（3.03% vs 3.73%），但这是为了换取更好的流动性
   - 风险调整收益大幅提升（61万 vs 5万），说明单位风险的收益更高

3. **LCR合规性**：
   - 两种策略的LCR合规率都较低，说明需要进一步优化L1配置
   - VaR策略的合规率更高（11.11% vs 2.22%）

4. **实际意义**：
   - 从L2补充虽然可行，但频繁发生说明L1配置不足，可能影响市场信心
   - 从L3补充是严重问题，可能导致提前赎回损失和信任危机
   - VaR策略通过动态调整，在收益和流动性之间取得了更好的平衡

### 实验代码说明

实验代码位于 `scripts/reserve-comparison.js`，包含：
- `DataGenerator`：生成模拟赎回数据
- `VaRCalculator`：计算风险价值（VaR）
- `ReserveStrategy`：储备策略基类
- `FixedReserveStrategy`：固定储备策略
- `VaROptimizedStrategy`：VaR动态优化策略
- `ComparisonExperiment`：对比实验主程序

### 进一步优化方向

1. **提高LCR合规率**：增加L1配置比例，减少流动性不足
2. **优化重平衡频率**：根据市场波动动态调整重平衡频率
3. **考虑补充成本**：在收益计算中扣除从L2/L3补充的成本
4. **压力测试**：模拟极端市场情况（如挤兑）
5. **多目标优化**：同时优化收益、流动性和合规性

---

**注意**：这是一个教学演示项目，不应用于生产环境。生产环境需要额外的安全审计、合规检查和风险管理机制。
