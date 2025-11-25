// 配置信息 - 自动从部署信息文件读取
let CONFIG = {
    // 本地网络配置
    RPC_URL: 'http://127.0.0.1:8545',
    CHAIN_ID: 1337,
    
    // 合约地址（会自动从部署信息文件读取）
    HKDT_ADDRESS: '',
    PAYMENT_GATEWAY_ADDRESS: '',
    
    // HKDT ABI（简化版，只包含必要函数）
    HKDT_ABI: [
        "function balanceOf(address owner) view returns (uint256)",
        "function transfer(address to, uint256 amount) returns (bool)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
    ],
    
    // PaymentGateway ABI
    PAYMENT_GATEWAY_ABI: [
        "function pay(address merchant, string calldata orderId, uint256 amount)",
        "function getOrder(string calldata orderId) view returns (tuple(address payer, address merchant, uint256 amount, address token, uint8 status, uint256 timestamp))",
        "function isPaid(string calldata orderId) view returns (bool)",
        "event PaymentReceived(address indexed payer, address indexed merchant, string indexed orderId, uint256 amount, address token)"
    ]
};

// 全局变量
let provider = null;
let signer = null;
let hkdtContract = null;
let paymentGatewayContract = null;
let userAddress = null;

// 加载部署信息
async function loadDeploymentInfo() {
    // 获取当前页面的基础路径
    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const rootPath = basePath.includes('/frontend') ? basePath.replace('/frontend', '') : '';
    
    // 尝试多个可能的路径（取决于HTTP服务器的启动位置）
    const possiblePaths = [
        '../deployment-info.json',           // 从frontend目录启动服务器
        rootPath + '/deployment-info.json', // 从项目根目录启动服务器
        '/deployment-info.json',            // 绝对路径
        './deployment-info.json'            // 当前目录
    ];
    
    // 加载HKDT地址
    let hkdtLoaded = false;
    for (const path of possiblePaths) {
        try {
            const response = await fetch(path);
            if (response.ok) {
                const info = await response.json();
                CONFIG.HKDT_ADDRESS = info.contractAddress;
                console.log('✅ HKDT地址已加载:', CONFIG.HKDT_ADDRESS, '(从', path, ')');
                hkdtLoaded = true;
                break;
            }
        } catch (e) {
            // 继续尝试下一个路径
        }
    }
    
    // 加载PaymentGateway地址
    const gatewayPaths = [
        '../payment-gateway-info.json',
        rootPath + '/payment-gateway-info.json',
        '/payment-gateway-info.json',
        './payment-gateway-info.json'
    ];
    
    let gatewayLoaded = false;
    for (const path of gatewayPaths) {
        try {
            const response = await fetch(path);
            if (response.ok) {
                const info = await response.json();
                CONFIG.PAYMENT_GATEWAY_ADDRESS = info.contractAddress;
                console.log('✅ PaymentGateway地址已加载:', CONFIG.PAYMENT_GATEWAY_ADDRESS, '(从', path, ')');
                gatewayLoaded = true;
                break;
            }
        } catch (e) {
            // 继续尝试下一个路径
        }
    }
    
    // 验证地址
    if (!hkdtLoaded) {
        console.error('❌ 错误：无法加载HKDT合约地址');
        console.error('尝试的路径:', possiblePaths);
        console.error('请确保：');
        console.error('1. 已运行 npm run deploy:local');
        console.error('2. deployment-info.json 文件在项目根目录');
        console.error('3. 从项目根目录启动HTTP服务器: python -m http.server 8000');
        showAlert('无法加载合约地址，请从项目根目录启动服务器', 'error');
        return false;
    }
    
    return true;
}

// 初始化函数
async function initApp() {
    // 检查ethers是否加载
    if (typeof ethers === 'undefined') {
        console.error('ethers.js 未加载');
        showAlert('ethers.js 加载失败，请刷新页面重试', 'error');
        return;
    }
    
    // 加载部署信息
    const loaded = await loadDeploymentInfo();
    if (!loaded) {
        return;
    }
    
    // 检查是否安装了MetaMask
    if (typeof window.ethereum === 'undefined') {
        showAlert('请安装 MetaMask 钱包扩展', 'error');
        return;
    }
    
    // 创建provider（连接到本地网络，ethers v6 写法）
    provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    
    // 检查是否已连接
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    } catch (error) {
        console.error('检查账户失败:', error);
    }
    
    // 监听账户切换
    if (window.ethereum.on) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                connectWallet();
            }
        });
    }
}

// 页面加载完成后初始化
window.addEventListener('load', function() {
    // 延迟一下，确保ethers.js已加载
    setTimeout(function() {
        if (typeof ethers !== 'undefined') {
            initApp();
        } else {
            console.log('等待ethers.js加载...');
            // 如果ethers还没加载，每100ms检查一次
            const checkInterval = setInterval(function() {
                if (typeof ethers !== 'undefined') {
                    clearInterval(checkInterval);
                    initApp();
                }
            }, 100);
            
            // 10秒后超时
            setTimeout(function() {
                clearInterval(checkInterval);
                if (typeof ethers === 'undefined') {
                    showAlert('ethers.js 加载超时，请刷新页面', 'error');
                }
            }, 10000);
        }
    }, 200);
});

// 连接钱包
async function connectWallet() {
    try {
        // 请求连接MetaMask
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // 切换到本地网络（如果不在本地网络）
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ethers.toBeHex(CONFIG.CHAIN_ID) }]
            });
        } catch (switchError) {
            // 如果网络不存在，添加网络
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: ethers.toBeHex(CONFIG.CHAIN_ID),
                        chainName: 'Hardhat Local',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: [CONFIG.RPC_URL]
                    }]
                });
            }
        }
        
        // 创建signer（ethers v6：BrowserProvider）
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        signer = await web3Provider.getSigner();
        userAddress = await signer.getAddress();
        
        // 初始化合约
        hkdtContract = new ethers.Contract(CONFIG.HKDT_ADDRESS, CONFIG.HKDT_ABI, signer);
        
        if (CONFIG.PAYMENT_GATEWAY_ADDRESS) {
            paymentGatewayContract = new ethers.Contract(
                CONFIG.PAYMENT_GATEWAY_ADDRESS,
                CONFIG.PAYMENT_GATEWAY_ABI,
                signer
            );
        }
        
        // 更新UI
        updateWalletStatus();
        await updateBalance();
        
        showAlert('钱包连接成功！', 'success');
    } catch (error) {
        console.error('连接钱包失败:', error);
        showAlert('连接钱包失败: ' + error.message, 'error');
    }
}

// 断开钱包
function disconnectWallet() {
    provider = null;
    signer = null;
    hkdtContract = null;
    paymentGatewayContract = null;
    userAddress = null;
    
    document.getElementById('walletStatus').textContent = '未连接';
    document.getElementById('walletStatus').className = 'status disconnected';
    document.getElementById('accountAddress').textContent = '-';
    document.getElementById('hkdtBalance').textContent = '-';
    document.getElementById('connectBtn').textContent = '连接钱包';
    document.getElementById('payBtn').disabled = true;
}

// 更新钱包状态
function updateWalletStatus() {
    if (userAddress) {
        document.getElementById('walletStatus').textContent = '已连接';
        document.getElementById('walletStatus').className = 'status connected';
        document.getElementById('accountAddress').textContent = 
            userAddress.substring(0, 6) + '...' + userAddress.substring(38);
        document.getElementById('connectBtn').textContent = '断开连接';
        document.getElementById('connectBtn').onclick = disconnectWallet;
        document.getElementById('payBtn').disabled = false;
    }
}

// 更新余额
async function updateBalance() {
    if (!hkdtContract || !userAddress) return;
    
    try {
        const balance = await hkdtContract.balanceOf(userAddress);
        const balanceFormatted = ethers.formatEther(balance);
        document.getElementById('hkdtBalance').textContent = 
            parseFloat(balanceFormatted).toFixed(2) + ' HKDT';
    } catch (error) {
        console.error('获取余额失败:', error);
        document.getElementById('hkdtBalance').textContent = '查询失败';
    }
}

// 支付订单
async function payOrder() {
    if (!signer || !hkdtContract) {
        showAlert('请先连接钱包', 'error');
        return;
    }
    
    const orderId = document.getElementById('orderId').value.trim();
    const merchantAddress = document.getElementById('merchantAddress').value.trim();
    const amount = document.getElementById('amount').value;
    
    // 验证输入
    if (!orderId) {
        showAlert('请输入订单ID', 'error');
        return;
    }
    
    if (!merchantAddress || !ethers.isAddress(merchantAddress)) {
        showAlert('请输入有效的商户地址', 'error');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        showAlert('请输入有效的支付金额', 'error');
        return;
    }
    
    try {
        showAlert('正在处理支付...', 'info');
        document.getElementById('payBtn').disabled = true;
        
        // 转换金额为wei（ethers v6）
        const amountWei = ethers.parseEther(amount);
        
        // 检查余额（ethers v6 返回 bigint，直接用比较运算符）
        const balance = await hkdtContract.balanceOf(userAddress);
        if (balance < amountWei) {
            showAlert('HKDT余额不足', 'error');
            document.getElementById('payBtn').disabled = false;
            return;
        }
        
        // 如果有PaymentGateway，使用它；否则直接转账
        if (paymentGatewayContract) {
            // 检查并授权PaymentGateway使用HKDT（ethers v6：allowance 也是 bigint）
            const allowance = await hkdtContract.allowance(userAddress, CONFIG.PAYMENT_GATEWAY_ADDRESS);
            if (allowance < amountWei) {
                showAlert('正在授权PaymentGateway使用HKDT...', 'info');
                // 授权一个较大的数量（例如10000 HKDT），避免每次都要授权
                const approveAmount = ethers.parseEther("10000");
                const approveTx = await hkdtContract.approve(CONFIG.PAYMENT_GATEWAY_ADDRESS, approveAmount);
                await approveTx.wait();
                showAlert('授权成功，正在支付...', 'success');
            }
            
            // 使用PaymentGateway支付
            const tx = await paymentGatewayContract.pay(merchantAddress, orderId, amountWei);
            showAlert('交易已提交，等待确认...', 'info');
            await tx.wait();
        } else {
            // 直接转账
            const tx = await hkdtContract.transfer(merchantAddress, amountWei);
            showAlert('交易已提交，等待确认...', 'info');
            await tx.wait();
        }
        
        showAlert(`支付成功！订单ID: ${orderId}`, 'success');
        
        // 更新余额
        await updateBalance();
        
        // 添加到订单列表
        addOrderToList(orderId, merchantAddress, amount, 'success');
        
        // 清空表单
        document.getElementById('orderId').value = '';
        document.getElementById('amount').value = '10';
        
    } catch (error) {
        console.error('支付失败:', error);
        showAlert('支付失败: ' + (error.message || error.reason || '未知错误'), 'error');
    } finally {
        document.getElementById('payBtn').disabled = false;
    }
}

// 显示提示信息
function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(alert);
    
    // 3秒后自动消失
    setTimeout(() => {
        alert.remove();
    }, 3000);
}

// 添加订单到列表
function addOrderToList(orderId, merchant, amount, status) {
    const orderList = document.getElementById('orderList');
    
    // 如果显示"暂无订单"，先清空
    if (orderList.querySelector('p')) {
        orderList.innerHTML = '';
    }
    
    const orderItem = document.createElement('div');
    orderItem.className = 'info-item';
    orderItem.style.padding = '10px';
    orderItem.style.marginBottom = '10px';
    orderItem.style.background = '#fff';
    orderItem.style.borderRadius = '5px';
    
    const statusEmoji = status === 'success' ? '✅' : '⏳';
    orderItem.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; margin-bottom: 5px;">${statusEmoji} ${orderId}</div>
                <div style="font-size: 12px; color: #666;">
                    商户: ${merchant.substring(0, 6)}...${merchant.substring(38)}<br>
                    金额: ${amount} HKDT
                </div>
            </div>
            <div style="color: #28a745; font-weight: 600;">${status === 'success' ? '已支付' : '处理中'}</div>
        </div>
    `;
    
    orderList.insertBefore(orderItem, orderList.firstChild);
}

