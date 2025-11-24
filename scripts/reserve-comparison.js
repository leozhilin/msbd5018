const fs = require("fs");

// ========== 数据生成器 ==========
class DataGenerator {
    // 生成模拟赎回数据
    static generateRedeemData(days, options = {}) {
        const {
            baseAmount = 200,      // 基础赎回量（万）
            volatility = 0.3,      // 波动率
            trend = 0,             // 趋势（0=无趋势）
            spikeDays = [],        // 突发高峰日期
            spikeAmount = 1000     // 高峰金额
        } = options;

        const data = [];
        for (let day = 0; day < days; day++) {
            let amount = baseAmount;
            
            // 添加趋势
            amount += trend * day;
            
            // 添加随机波动
            const random = (Math.random() - 0.5) * 2; // -1 到 1
            amount *= (1 + random * volatility);
            
            // 添加突发高峰
            if (spikeDays.includes(day)) {
                amount = spikeAmount;
            }
            
            // 确保非负
            amount = Math.max(0, amount);
            
            data.push(Math.round(amount * 10000)); // 转换为实际金额
        }
        
        return data;
    }

    // 从文件加载数据（如果使用真实数据）
    static loadFromFile(filepath) {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            return JSON.parse(content);
        } catch (e) {
            return null;
        }
    }
}

// ========== VaR计算器 ==========
class VaRCalculator {
    constructor(confidenceLevel = 0.95) {
        this.confidenceLevel = confidenceLevel;
        this.history = [];
    }

    addHistory(dailyAmount) {
        this.history.push(dailyAmount);
        // 只保留最近100天
        if (this.history.length > 100) {
            this.history.shift();
        }
    }

    calculateVaR(days = 7) {
        if (this.history.length < 30) {
            // 数据不足，用简单估计
            const avg = this.average(this.history);
            return avg * days * 2; // 保守估计
        }

        const sorted = [...this.history].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * this.confidenceLevel) - 1;
        const percentile = sorted[index];
        
        return percentile * days;
    }

    average(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
}

// ========== 储备策略基类 ==========
class ReserveStrategy {
    constructor(name, L1_rate, L2_rate, L3_rate) {
        this.name = name;
        this.L1_rate = L1_rate;
        this.L2_rate = L2_rate;
        this.L3_rate = L3_rate;
        
        this.L1 = 0;
        this.L2 = 0;
        this.L3 = 0;
        
        // 统计指标
        this.metrics = {
            totalRedeemed: 0,
            liquidityShortfallCount: 0,
            maxLiquidityGap: 0,
            totalReturn: 0,
            lcrComplianceDays: 0,
            totalDays: 0,
            // 细粒度流动性不足统计
            l2ToL1Count: 0,        // 需要从L2补充到L1的次数
            l3ToL1Count: 0,        // 需要从L3补充的次数
            l2ToL1Amount: 0,       // 从L2补充的总金额
            l3ToL1Amount: 0        // 从L3补充的总金额
        };
    }

    initialize(totalReserve) {
        this.L1 = totalReserve * this.L1_rate;
        this.L2 = totalReserve * this.L2_rate;
        this.L3 = totalReserve * this.L3_rate;
    }

    getTotal() {
        return this.L1 + this.L2 + this.L3;
    }

    // 处理赎回
    redeem(amount, day, var7 = 0) {
        this.metrics.totalRedeemed += amount;
        this.metrics.totalDays = day;

        // 注意：LCR合规性应该在每天开始时检查（在重平衡后）
        // 这里先不检查，由外部在重平衡后调用checkLCR

        // 检查流动性是否充足
        if (this.L1 < amount) {
            this.metrics.liquidityShortfallCount++;
            const gap = amount - this.L1;
            this.metrics.maxLiquidityGap = Math.max(this.metrics.maxLiquidityGap, gap);
            
            // 从L2补充
            const needed = amount - this.L1;
            if (this.L2 >= needed) {
                // 只需要从L2补充（代价较小）
                this.metrics.l2ToL1Count++;
                this.metrics.l2ToL1Amount += needed;
                this.L2 -= needed;
                this.L1 += needed;
            } else {
                // L2也不够，需要从L3补充（代价较大）
                this.metrics.l3ToL1Count++;
                const fromL2 = this.L2;
                const fromL3 = needed - fromL2;
                this.metrics.l2ToL1Amount += fromL2;  // 记录从L2补充的部分
                this.metrics.l3ToL1Amount += fromL3;  // 记录从L3补充的部分
                
                if (this.L3 >= fromL3) {
                    this.L2 = 0;
                    this.L3 -= fromL3;
                    this.L1 += fromL2;
                } else {
                    // 总储备不足，只能支付部分
                    const totalAvailable = this.L1 + this.L2 + this.L3;
                    this.L1 = 0;
                    this.L2 = 0;
                    this.L3 = 0;
                    // 注意：实际应该记录失败，这里简化
                }
            }
        }

        // 支付
        this.L1 -= amount;
        
        // 模拟新资金流入（保持储备稳定）
        // 假设每天有新的存入，等于平均赎回量（保持储备平衡）
        // 这里简化：每天补充等于赎回量（模拟新用户存入 = 用户赎回）
        const dailyInflow = amount; // 新存入 = 赎回量（保持平衡）
        
        // 按当前比例分配新资金
        const currentTotal = this.getTotal();
        if (currentTotal > 0) {
            const L1_ratio = this.L1 / currentTotal;
            const L2_ratio = this.L2 / currentTotal;
            const L3_ratio = this.L3 / currentTotal;
            
            this.L1 += dailyInflow * L1_ratio;
            this.L2 += dailyInflow * L2_ratio;
            this.L3 += dailyInflow * L3_ratio;
        } else {
            // 如果储备耗尽，按初始比例重新分配
            this.initialize(dailyInflow * 100); // 假设初始储备
        }
    }

    // 计算收益（假设L2年化3%，L3年化5%）
    // 使用平均储备计算，更准确
    calculateReturn(days, avgL2, avgL3) {
        const L2_daily = avgL2 * 0.03 / 365;
        const L3_daily = avgL3 * 0.05 / 365;
        return (L2_daily + L3_daily) * days;
    }

    // 检查LCR合规性
    checkLCR(var7) {
        if (this.L1 >= var7) {
            this.metrics.lcrComplianceDays++;
        }
    }

    // 更新收益（基于当前储备）
    updateReturn(days) {
        // 使用当前储备计算（简化，实际应该用平均储备）
        const L2_daily = this.L2 * 0.03 / 365;
        const L3_daily = this.L3 * 0.05 / 365;
        this.metrics.totalReturn += (L2_daily + L3_daily) * days;
    }

    // 获取指标
    getMetrics(var7, initialReserve) {
        const total = this.getTotal();
        const annualReturn = this.metrics.totalReturn * (365 / this.metrics.totalDays);
        
        // 使用初始储备计算收益率（更准确）
        const baseReserve = initialReserve || total;
        const returnRate = baseReserve > 0 ? (annualReturn / baseReserve) * 100 : 0;
        
        const lcrComplianceRate = this.metrics.totalDays > 0 
            ? (this.metrics.lcrComplianceDays / this.metrics.totalDays) * 100 
            : 0;

        return {
            name: this.name,
            totalReserve: total,
            annualReturn: annualReturn,
            returnRate: returnRate,
            liquidityShortfallCount: this.metrics.liquidityShortfallCount,
            maxLiquidityGap: this.metrics.maxLiquidityGap,
            lcrComplianceRate: lcrComplianceRate,
            // 细粒度流动性不足统计
            l2ToL1Count: this.metrics.l2ToL1Count,
            l3ToL1Count: this.metrics.l3ToL1Count,
            l2ToL1Amount: this.metrics.l2ToL1Amount,
            l3ToL1Amount: this.metrics.l3ToL1Amount,
            riskAdjustedReturn: this.metrics.liquidityShortfallCount > 0
                ? annualReturn / this.metrics.liquidityShortfallCount
                : annualReturn
        };
    }
}

// ========== 固定储备策略 ==========
class FixedReserveStrategy extends ReserveStrategy {
    constructor() {
        super("固定储备方案", 0.20, 0.70, 0.10);
    }

    // 固定比例，不调整（但需要保持比例）
    rebalance(totalReserve, var7, var30) {
        // 固定策略：保持固定比例
        const currentTotal = this.getTotal();
        if (currentTotal > 0) {
            // 如果总储备变化，按比例调整
            const ratio = totalReserve / currentTotal;
            this.L1 = this.L1 * ratio;
            this.L2 = this.L2 * ratio;
            this.L3 = this.L3 * ratio;
        } else {
            // 重新初始化
            this.initialize(totalReserve);
        }
    }
}

// ========== VaR动态优化策略 ==========
class VaROptimizedStrategy extends ReserveStrategy {
    constructor() {
        super("VaR动态优化方案", 0, 0, 0); // 初始为0，动态计算
        this.varCalculator = new VaRCalculator(0.95);
    }

    // 记录历史数据
    recordHistory(dailyAmount) {
        this.varCalculator.addHistory(dailyAmount);
    }

    // 动态优化
    rebalance(totalReserve, var7, var30) {
        // 计算最优配置
        const optimal = this.solveOptimization(totalReserve, var7, var30);
        
        this.L1 = optimal.L1;
        this.L2 = optimal.L2;
        this.L3 = optimal.L3;
    }

    // 求解优化问题
    solveOptimization(total, var7, var30) {
        // 约束1: L1 >= VaR(7天)
        let L1 = Math.max(var7, total * 0.1);  // 至少10%
        L1 = Math.min(L1, total * 0.4);  // 最多40%

        // 约束2: L1 + L2 >= VaR(30天)
        const minL2 = Math.max(0, var30 - L1);
        let L2 = Math.max(minL2, total * 0.3);  // 至少30%
        L2 = Math.min(L2, total * 0.6);  // 最多60%

        // 剩余给L3
        let L3 = total - L1 - L2;
        L3 = Math.max(0, L3);
        L3 = Math.min(L3, total * 0.3);  // 最多30%

        // 重新归一化
        const sum = L1 + L2 + L3;
        if (sum > 0) {
            L1 = (L1 / sum) * total;
            L2 = (L2 / sum) * total;
            L3 = (L3 / sum) * total;
        }

        return { L1, L2, L3 };
    }
}

// ========== 对比实验 ==========
class ComparisonExperiment {
    constructor() {
        this.fixedStrategy = new FixedReserveStrategy();
        this.varStrategy = new VaROptimizedStrategy();
        this.totalReserve = 10000 * 10000; // 1亿HKD
    }

    // 运行实验
    run(historicalData, futureData) {
        console.log("=".repeat(60));
        console.log("🧪 储备管理策略对比实验");
        console.log("=".repeat(60));

        // 初始化
        this.fixedStrategy.initialize(this.totalReserve);
        this.varStrategy.initialize(this.totalReserve);

        // 用历史数据计算VaR
        console.log("\n📊 计算VaR...");
        historicalData.forEach(amount => {
            this.varStrategy.recordHistory(amount);
        });

        const var7 = this.varStrategy.varCalculator.calculateVaR(7);
        const var30 = this.varStrategy.varCalculator.calculateVaR(30);
        console.log(`  VaR(7天, 95%): ${this.formatAmount(var7)}`);
        console.log(`  VaR(30天, 95%): ${this.formatAmount(var30)}`);

        // 初始优化
        this.varStrategy.rebalance(this.totalReserve, var7, var30);
        console.log("\n🎯 VaR策略初始配置:");
        this.printReserves(this.varStrategy);

        // 运行未来数据
        console.log("\n📈 运行未来数据...");
        for (let day = 0; day < futureData.length; day++) {
            const redeemAmount = futureData[day];

            // 每天开始时重平衡（VaR策略）
            if (day > 0 && day % 7 === 0) { // 每周重平衡一次
                const currentVar7 = this.varStrategy.varCalculator.calculateVaR(7);
                const currentVar30 = this.varStrategy.varCalculator.calculateVaR(30);
                const currentTotal = this.varStrategy.getTotal();
                this.varStrategy.rebalance(currentTotal, currentVar7, currentVar30);
            }

            // 每天开始时检查LCR合规性（在重平衡后，赎回前）
            const currentVar7 = day === 0 ? var7 : this.varStrategy.varCalculator.calculateVaR(7);
            this.fixedStrategy.checkLCR(currentVar7);
            this.varStrategy.checkLCR(currentVar7);

            // 更新收益（在赎回前计算，基于完整的L2/L3余额）
            this.fixedStrategy.updateReturn(1);
            this.varStrategy.updateReturn(1);

            // 处理赎回（会自动补充新资金）
            this.fixedStrategy.redeem(redeemAmount, day + 1, currentVar7);
            this.varStrategy.redeem(redeemAmount, day + 1, currentVar7);

            // 记录历史（用于更新VaR）
            this.varStrategy.recordHistory(redeemAmount);
        }

        // 输出结果
        this.printResults(var7, this.totalReserve);
    }

    printReserves(strategy) {
        const total = strategy.getTotal();
        console.log(`  L1: ${this.formatAmount(strategy.L1)} (${(strategy.L1/total*100).toFixed(1)}%)`);
        console.log(`  L2: ${this.formatAmount(strategy.L2)} (${(strategy.L2/total*100).toFixed(1)}%)`);
        console.log(`  L3: ${this.formatAmount(strategy.L3)} (${(strategy.L3/total*100).toFixed(1)}%)`);
    }

    printResults(var7, initialReserve) {
        console.log("\n" + "=".repeat(60));
        console.log("📊 实验结果对比");
        console.log("=".repeat(60));

        const fixedMetrics = this.fixedStrategy.getMetrics(var7, initialReserve);
        const varMetrics = this.varStrategy.getMetrics(var7, initialReserve);

        console.log("\n【固定储备方案】");
        this.printMetrics(fixedMetrics);

        console.log("\n【VaR动态优化方案】");
        this.printMetrics(varMetrics);

        console.log("\n【对比分析】");
        const returnDiff = varMetrics.returnRate - fixedMetrics.returnRate;
        const shortfallDiff = fixedMetrics.liquidityShortfallCount - varMetrics.liquidityShortfallCount;
        const lcrDiff = varMetrics.lcrComplianceRate - fixedMetrics.lcrComplianceRate;
        const l2CountDiff = fixedMetrics.l2ToL1Count - varMetrics.l2ToL1Count;
        const l3CountDiff = fixedMetrics.l3ToL1Count - varMetrics.l3ToL1Count;
        
        console.log(`收益率提升: ${returnDiff.toFixed(2)}% ${returnDiff > 0 ? '✅' : '❌'}`);
        console.log(`流动性不足次数减少: ${shortfallDiff} ${shortfallDiff > 0 ? '✅' : '❌'}`);
        console.log(`  - 从L2补充次数减少: ${l2CountDiff} ${l2CountDiff > 0 ? '✅' : '❌'}`);
        console.log(`  - 从L3补充次数减少: ${l3CountDiff} ${l3CountDiff > 0 ? '✅' : '❌'}`);
        console.log(`LCR合规率提升: ${lcrDiff.toFixed(2)}% ${lcrDiff > 0 ? '✅' : '❌'}`);
        console.log(`最大流动性缺口减少: ${this.formatAmount(fixedMetrics.maxLiquidityGap - varMetrics.maxLiquidityGap)}`);
    }

    printMetrics(metrics) {
        console.log(`  策略名称: ${metrics.name}`);
        console.log(`  年化收益率: ${this.formatAmount(metrics.annualReturn)} (${metrics.returnRate.toFixed(2)}%)`);
        console.log(`  流动性不足次数: ${metrics.liquidityShortfallCount}`);
        console.log(`    - 从L2补充次数: ${metrics.l2ToL1Count} (总金额: ${this.formatAmount(metrics.l2ToL1Amount)})`);
        console.log(`    - 从L3补充次数: ${metrics.l3ToL1Count} (总金额: ${this.formatAmount(metrics.l3ToL1Amount)})`);
        console.log(`  最大流动性缺口: ${this.formatAmount(metrics.maxLiquidityGap)}`);
        console.log(`  LCR合规率: ${metrics.lcrComplianceRate.toFixed(2)}%`);
        console.log(`  风险调整收益: ${this.formatAmount(metrics.riskAdjustedReturn)}`);
    }

    formatAmount(amount) {
        return (amount / 10000).toFixed(0) + "万 HKD";
    }
}

// ========== 主程序 ==========
async function main() {
    // 生成数据
    console.log("📊 生成测试数据...");
    
    // 历史数据（用于计算VaR）
    const historicalData = DataGenerator.generateRedeemData(100, {
        baseAmount: 200,
        volatility: 0.3,
        spikeDays: [20, 45, 70],
        spikeAmount: 800
    });

    // 未来数据（用于测试）
    const futureData = DataGenerator.generateRedeemData(90, {
        baseAmount: 200,
        volatility: 0.4,
        trend: 0.5, // 轻微上升趋势
        spikeDays: [10, 30, 60],
        spikeAmount: 1000
    });

    // 运行实验
    const experiment = new ComparisonExperiment();
    experiment.run(historicalData, futureData);
}

// 运行
main()
    .then(() => {
        console.log("\n✅ 实验完成！");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ 实验失败:", error);
        process.exit(1);
    });

