// 本地 Hardhat HKDT 仪表盘（不依赖 Etherscan）

const CONFIG = {
  RPC_URL: "http://127.0.0.1:8545",
  CHAIN_ID: 1337,
  HKDT_ADDRESS: "",
  PAYMENT_GATEWAY_ADDRESS: "",

  // 查询最近多少个区块的事件
  BLOCK_LOOKBACK: 2000,

  HKDT_ABI: [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Minted(address indexed to, uint256 amount)",
    "event Redeemed(address indexed from, uint256 amount, string bankRef)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
  ],
  PAYMENT_GATEWAY_ABI: [
    "event PaymentReceived(address indexed payer, address indexed merchant, string indexed orderId, uint256 amount, address token)",
  ],
};

// 全局状态
let provider = null;
let hkdt = null;
let paymentGateway = null;
let activityChart = null;
let rawEvents = []; // 合并的所有事件（Transfer/Mint/Redeem/Payment）

// 简单 DOM 工具
function $(id) {
  return document.getElementById(id);
}

function formatAddress(addr) {
  if (!addr) return "-";
  addr = String(addr);
  if (addr.length <= 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatDate(tsSec) {
  const d = new Date(Number(tsSec) * 1000);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function formatAmount(amountWei) {
  const v = Number(amountWei) / 1e18;
  if (!isFinite(v)) return "0";
  if (v === 0) return "0";
  if (v < 0.0001) return v.toExponential(2);
  if (v < 1) return v.toFixed(4);
  if (v < 1000) return v.toFixed(4).replace(/\.?0+$/, "");
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// 设置连接状态文案
function setConnectionStatus(ok, msg) {
  const el = $("connectionStatus");
  if (!el) return;
  el.textContent = msg || (ok ? "已连接到本地 Hardhat 节点" : "连接异常");
}

// 加载本地部署信息
async function loadDeploymentInfo() {
  const basePath = window.location.pathname.substring(
    0,
    window.location.pathname.lastIndexOf("/")
  );
  const rootPath = basePath.includes("/frontend")
    ? basePath.replace("/frontend", "")
    : "";

  const hkdtPaths = [
    "../deployment-info.json",
    rootPath + "/deployment-info.json",
    "/deployment-info.json",
    "./deployment-info.json",
  ];

  let hkdtLoaded = false;
  for (const path of hkdtPaths) {
    try {
      const resp = await fetch(path);
      if (resp.ok) {
        const info = await resp.json();
        CONFIG.HKDT_ADDRESS = info.contractAddress;
        console.log("✅ HKDT 地址已加载:", CONFIG.HKDT_ADDRESS, "from", path);
        hkdtLoaded = true;
        break;
      }
    } catch (e) {
      // ignore and try next
    }
  }

  const gwPaths = [
    "../payment-gateway-info.json",
    rootPath + "/payment-gateway-info.json",
    "/payment-gateway-info.json",
    "./payment-gateway-info.json",
  ];

  for (const path of gwPaths) {
    try {
      const resp = await fetch(path);
      if (resp.ok) {
        const info = await resp.json();
        CONFIG.PAYMENT_GATEWAY_ADDRESS = info.contractAddress;
        console.log(
          "✅ PaymentGateway 地址已加载:",
          CONFIG.PAYMENT_GATEWAY_ADDRESS,
          "from",
          path
        );
        break;
      }
    } catch (e) {
      // ignore
    }
  }

  if (!hkdtLoaded) {
    console.error("❌ 无法加载 HKDT 合约地址");
    const msg =
      "无法加载 HKDT 部署信息，请确认已执行：npm run deploy:local，并从项目根目录启动前端服务器。";
    $("txTableBody").innerHTML = `<div class="error">${msg}</div>`;
    $("holdersBody").innerHTML = `<div class="error">${msg}</div>`;
    setConnectionStatus(false, "未找到 HKDT 部署信息");
    return false;
  }

  return true;
}

// 初始化：连接本地节点 + 实例化合约
async function initDashboard() {
  console.log("🎯 初始化 HKDT 本地仪表盘...");

  if (typeof ethers === "undefined") {
    const msg = "ethers.js 未加载，请检查网络或刷新页面。";
    console.error(msg);
    $("txTableBody").innerHTML = `<div class="error">${msg}</div>`;
    setConnectionStatus(false, "ethers.js 未加载");
    return;
  }

  setConnectionStatus(false, "正在连接本地 Hardhat 节点...");

  // 1. 加载部署信息（地址）
  const ok = await loadDeploymentInfo();
  if (!ok) return;

  // 2. 创建 provider（ethers v6：使用 ethers.JsonRpcProvider）
  try {
    provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const network = await provider.getNetwork();
    console.log("✅ 已连接到网络:", network);
    if (network.chainId !== CONFIG.CHAIN_ID) {
      console.warn(
        "警告：当前链 ID 不是 1337，实际为：",
        Number(network.chainId)
      );
    }
    setConnectionStatus(true, "已连接到本地 Hardhat 节点");
  } catch (e) {
    console.error("❌ 连接本地节点失败:", e);
    const msg =
      "无法连接到本地节点，请确认终端中已运行：npm run node，并监听在 127.0.0.1:8545。";
    $("txTableBody").innerHTML = `<div class="error">${msg}</div>`;
    $("holdersBody").innerHTML = `<div class="error">${msg}</div>`;
    setConnectionStatus(false, "本地节点连接失败");
    return;
  }

  // 3. 实例化合约
  try {
    hkdt = new ethers.Contract(
      CONFIG.HKDT_ADDRESS,
      CONFIG.HKDT_ABI,
      provider
    );
    console.log("✅ HKDT 合约实例已创建:", CONFIG.HKDT_ADDRESS);

    if (CONFIG.PAYMENT_GATEWAY_ADDRESS) {
      paymentGateway = new ethers.Contract(
        CONFIG.PAYMENT_GATEWAY_ADDRESS,
        CONFIG.PAYMENT_GATEWAY_ABI,
        provider
      );
      console.log(
        "✅ PaymentGateway 合约实例已创建:",
        CONFIG.PAYMENT_GATEWAY_ADDRESS
      );
    } else {
      console.log("ℹ️ 未找到 PaymentGateway 部署信息，仅展示 HKDT 事件。");
    }
  } catch (e) {
    console.error("❌ 创建合约实例失败:", e);
    const msg =
      "创建 HKDT / PaymentGateway 合约实例失败，请检查部署信息和本地区块链状态。";
    $("txTableBody").innerHTML = `<div class="error">${msg}</div>`;
    $("holdersBody").innerHTML = `<div class="error">${msg}</div>`;
    return;
  }

  // 4. 加载所有数据
  await loadAllData();
  bindEvents();
}

// 从链上读取事件
async function loadEvents() {
  if (!provider || !hkdt) return;

  const container = $("txTableBody");
  if (container) {
    container.innerHTML =
      '<div class="loading"><span class="loading-spinner"></span> 正在从本地链读取 HKDT 事件...</div>';
  }

  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - CONFIG.BLOCK_LOOKBACK);
    console.log(
      `⛓ 读取区块范围 [${fromBlock}, ${currentBlock}] 内的事件...`
    );

    const events = [];

    // Transfer
    const transferFilter = hkdt.filters.Transfer();
    const transferLogs = await hkdt.queryFilter(
      transferFilter,
      fromBlock,
      currentBlock
    );
    for (const ev of transferLogs) {
      const block = await ev.getBlock();
      events.push({
        type: "Transfer",
        from: ev.args.from,
        to: ev.args.to,
        amount: ev.args.value,
        txHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        timeStamp: block.timestamp,
      });
    }

    // Minted
    const mintedFilter = hkdt.filters.Minted();
    const mintedLogs = await hkdt.queryFilter(
      mintedFilter,
      fromBlock,
      currentBlock
    );
    for (const ev of mintedLogs) {
      const block = await ev.getBlock();
      events.push({
        type: "Mint",
        from: null,
        to: ev.args.to,
        amount: ev.args.amount,
        txHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        timeStamp: block.timestamp,
      });
    }

    // Redeemed
    const redeemedFilter = hkdt.filters.Redeemed();
    const redeemedLogs = await hkdt.queryFilter(
      redeemedFilter,
      fromBlock,
      currentBlock
    );
    for (const ev of redeemedLogs) {
      const block = await ev.getBlock();
      events.push({
        type: "Redeem",
        from: ev.args.from,
        to: null,
        amount: ev.args.amount,
        bankRef: ev.args.bankRef,
        txHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        timeStamp: block.timestamp,
      });
    }

    // PaymentReceived（可选）
    if (paymentGateway) {
      const payFilter = paymentGateway.filters.PaymentReceived();
      const payLogs = await paymentGateway.queryFilter(
        payFilter,
        fromBlock,
        currentBlock
      );
      for (const ev of payLogs) {
        const block = await ev.getBlock();
        events.push({
          type: "Payment",
          from: ev.args.payer,
          to: ev.args.merchant,
          amount: ev.args.amount,
          orderId: ev.args.orderId,
          txHash: ev.transactionHash,
          blockNumber: ev.blockNumber,
          timeStamp: block.timestamp,
        });
      }
    }

    // 最新在前
    events.sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp));
    rawEvents = events;
    console.log(`✅ 共加载 ${events.length} 条事件`);
  } catch (e) {
    console.error("❌ 读取链上事件失败:", e);
    if ($("txTableBody")) {
      $("txTableBody").innerHTML =
        '<div class="error">读取本地链事件失败，请检查 hardhat 节点是否运行，以及合约是否已部署。</div>';
    }
  }
}

// 统计 & 渲染
function getRangeFilteredEvents() {
  const now = Math.floor(Date.now() / 1000);
  const range = $("rangeFilter") ? $("rangeFilter").value : "24h";
  let from = now - 24 * 3600;
  if (range === "7d") from = now - 7 * 24 * 3600;
  if (range === "30d") from = now - 30 * 24 * 3600;
  return rawEvents.filter((e) => Number(e.timeStamp) >= from);
}

function renderStats() {
  const evs = getRangeFilteredEvents();
  const totalTx = evs.length;
  const totalVolume = evs.reduce(
    (s, e) => s + Number(e.amount || 0) / 1e18,
    0
  );
  const addrSet = new Set();
  evs.forEach((e) => {
    if (e.from) addrSet.add(e.from.toLowerCase());
    if (e.to) addrSet.add(e.to.toLowerCase());
  });

  if ($("statTotalTx"))
    $("statTotalTx").textContent = totalTx.toLocaleString();
  if ($("statTotalVolume"))
    $("statTotalVolume").textContent = totalVolume.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  if ($("statActiveAddresses"))
    $("statActiveAddresses").textContent = addrSet.size.toLocaleString();
  if ($("statTokenCoverage"))
    $("statTokenCoverage").textContent = totalTx > 0 ? "HKDT" : "无数据";
}

function renderLatestTransactions() {
  const container = $("txTableBody");
  if (!container) return;

  const evs = getRangeFilteredEvents();
  const latest = evs.slice(0, 50);

  if (latest.length === 0) {
    container.innerHTML =
      '<div class="empty">当前时间范围内暂无 HKDT 交易记录。</div>';
    return;
  }

  const rows = latest.map((e) => {
    let typeLabel = "转账";
    if (e.type === "Mint") typeLabel = "铸币";
    else if (e.type === "Redeem") typeLabel = "赎回";
    else if (e.type === "Payment") typeLabel = "支付";

    const amountStr = formatAmount(e.amount || 0n);
    const timeStr = formatDate(e.timeStamp);

    const fromAddr =
      e.type === "Mint" ? "系统" : e.from ? formatAddress(e.from) : "-";
    const toAddr =
      e.type === "Redeem" ? "系统" : e.to ? formatAddress(e.to) : "-";

    return `
      <div class="table-row">
        <div>
          <span class="address-pill">
            <span class="mono">${fromAddr}</span>
          </span>
        </div>
        <div>
          <span class="address-pill">
            <span class="mono">${toAddr}</span>
          </span>
        </div>
        <div><span class="chip chip-accent">${typeLabel}</span></div>
        <div><span class="amount-positive">${amountStr}</span></div>
        <div><span class="mono">${timeStr}</span></div>
      </div>
    `;
  });

  container.innerHTML = rows.join("");
  const tag = $("latestCountTag");
  if (tag) tag.textContent = `N = ${latest.length}`;
}

function renderTopHolders() {
  const container = $("holdersBody");
  if (!container) return;

  const evs = getRangeFilteredEvents();
  if (evs.length === 0) {
    container.innerHTML =
      '<div class="empty">当前时间范围内暂无可统计的持币地址。</div>';
    return;
  }

  const balances = new Map(); // addr => balance(HKDT)

  evs.forEach((e) => {
    const from = e.from ? e.from.toLowerCase() : null;
    const to = e.to ? e.to.toLowerCase() : null;
    const value = Number(e.amount || 0) / 1e18;
    if (!isFinite(value) || value <= 0) return;

    if (e.type === "Mint") {
      if (to) balances.set(to, (balances.get(to) || 0) + value);
    } else if (e.type === "Redeem") {
      if (from) balances.set(from, (balances.get(from) || 0) - value);
    } else if (e.type === "Transfer" || e.type === "Payment") {
      if (from) balances.set(from, (balances.get(from) || 0) - value);
      if (to) balances.set(to, (balances.get(to) || 0) + value);
    }
  });

  const list = [];
  for (const [addr, bal] of balances.entries()) {
    if (bal > 0) list.push({ address: addr, balance: bal });
  }

  list.sort((a, b) => b.balance - a.balance);
  const top = list.slice(0, 10);

  if (top.length === 0) {
    container.innerHTML =
      '<div class="empty">尚未统计到正余额地址（可能仅有赎回事件）。</div>';
    return;
  }

  const total = top.reduce((s, x) => s + x.balance, 0) || 1;
  const rows = top.map((h, idx) => {
    const share = (h.balance / total) * 100;
    let cls = "holder-rank";
    if (idx === 1) cls += " secondary";
    else if (idx >= 2) cls += " muted";
    return `
      <div class="holder-row">
        <div><div class="${cls}">${idx + 1}</div></div>
        <div>
          <span class="address-pill">
            <span class="mono">${formatAddress(h.address)}</span>
          </span>
        </div>
        <div><span class="amount-positive">${h.balance.toLocaleString(undefined,{maximumFractionDigits:4})}</span></div>
        <div><span class="chip">${share.toFixed(2)}%</span></div>
      </div>
    `;
  });

  container.innerHTML = rows.join("");
}

function renderActivityChart() {
  const canvas = $("activityChart");
  if (!canvas) return;

  // 仅看最近 24 小时的单笔交易
  const now = Math.floor(Date.now() / 1000);
  const from = now - 24 * 3600;
  const evs = rawEvents
    .filter((e) => Number(e.timeStamp) >= from)
    .sort((a, b) => Number(a.timeStamp) - Number(b.timeStamp));

  const labels = evs.map((e) => {
    const d = new Date(Number(e.timeStamp) * 1000);
    return (
      d.getHours().toString().padStart(2, "0") +
      ":" +
      d.getMinutes().toString().padStart(2, "0") +
      ":" +
      d.getSeconds().toString().padStart(2, "0")
    );
  });

  const volumes = evs.map(
    (e) => Number(e.amount || 0) / 1e18
  );

  const ctx = canvas.getContext("2d");
  if (activityChart) activityChart.destroy();

  activityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "单笔交易量",
          data: volumes,
          borderColor: "rgba(56, 189, 248, 1)",
          backgroundColor: "rgba(56, 189, 248, 0.18)",
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "nearest",
          intersect: false,
          callbacks: {
            label: function (ctx) {
              const i = ctx.dataIndex;
              const e = evs[i];
              const amount = ctx.formattedValue;
              const type = e.type || "Tx";
              return `${type}：${amount} HKDT`;
            },
            footer: function (items) {
              if (!items.length) return "";
              const i = items[0].dataIndex;
              const e = evs[i];
              return `时间：${formatDate(e.timeStamp)}`;
            },
          },
        },
      },
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: {
          grid: { color: "rgba(31,41,55,0.7)" },
          ticks: {
            color: "#6b7280",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          position: "left",
          grid: { color: "rgba(31,41,55,0.7)" },
          ticks: { color: "#9ca3af" },
          title: { display: true, text: "单笔交易量 (HKDT)", color: "#9ca3af" },
        },
      },
    },
  });

  $("activityRangeLabel").textContent = "最近 24 小时";
  const totalCount = evs.length;
  const totalVol = volumes.reduce((s, v) => s + (isFinite(v) ? v : 0), 0);
  $("activitySummary").textContent = `24 小时内共 ${totalCount} 笔交易，单笔最大 ≈ ${
    volumes.length ? Math.max(...volumes).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 0
  } HKDT，总量 ≈ ${totalVol.toLocaleString(undefined, { maximumFractionDigits: 2 })} HKDT`;
}

async function loadAllData() {
  await loadEvents();
  renderStats();
  renderLatestTransactions();
  renderTopHolders();
  renderActivityChart();
}

function bindEvents() {
  const rangeFilter = $("rangeFilter");
  const refreshAllBtn = $("refreshAllBtn");
  const refreshTxBtn = $("refreshTxBtn");
  const refreshHoldersBtn = $("refreshHoldersBtn");

  if (rangeFilter) {
    rangeFilter.addEventListener("change", () => {
      renderStats();
      renderLatestTransactions();
      renderTopHolders();
      renderActivityChart();
    });
  }

  if (refreshAllBtn) {
    refreshAllBtn.addEventListener("click", () => {
      loadAllData();
    });
  }

  if (refreshTxBtn) {
    refreshTxBtn.addEventListener("click", () => {
      renderLatestTransactions();
    });
  }

  if (refreshHoldersBtn) {
    refreshHoldersBtn.addEventListener("click", () => {
      renderTopHolders();
    });
  }
}

// 页面加载时初始化（使用本地 node_modules 中的 ethers.umd.min.js）
window.addEventListener("load", () => {
  if (typeof ethers === "undefined") {
    const msg =
      "未能加载本地 ethers 库，请确认：<br>1. 已在项目根目录执行过 npm install<br>2. 是从项目根目录启动 http-server（或 python -m http.server）。";
    if ($("txTableBody")) {
      $("txTableBody").innerHTML = `<div class="error">${msg}</div>`;
    }
    setConnectionStatus(false, "本地 ethers 加载失败");
    return;
  }

  initDashboard();
});


