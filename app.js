"use strict";
const ADDRESS="0x00038E4172086f03E31b034e3eAf76b2f1870BD9";
const RPC="https://bsc-dataseed.binance.org/";
const ABI=["function owner() view returns(address)","function companyWallet() view returns(address)","function feeWallet() view returns(address)","function companyBps() view returns(uint16)","function thbcPerUsdt() view returns(uint256)","function paused() view returns(bool)","function nextPurchaseId() view returns(uint256)","function usdt() view returns(address)","function thbc() view returns(address)","function setRate(uint256)","function setCompanyBps(uint16)","function setWallets(address,address)","function distributeReward(address,uint256)","function withdrawTHBCReserve(address,uint256)","function pause()","function unpause()"];
const TOKEN_ABI=["function balanceOf(address) view returns(uint256)","function decimals() view returns(uint8)"];
const el=id=>document.getElementById(id);
const readProvider=new ethers.JsonRpcProvider(RPC,56);
let walletProvider=null,signer=null,account=null,owner=null,busy=false;
const contract=new ethers.Contract(ADDRESS,ABI,readProvider);
function message(t){el("notice").textContent=t}
function fmt(v,d=18){return Number(ethers.formatUnits(v,d)).toLocaleString("en-US",{maximumFractionDigits:6})}
function validAddress(v){if(!ethers.isAddress(v))throw Error("Invalid wallet address");return ethers.getAddress(v)}
function amount(v){const s=String(v).trim();if(!/^\d+(\.\d+)?$/.test(s))throw Error("Enter a valid positive amount");const n=ethers.parseUnits(s,18);if(n<=0n)throw Error("Amount must be greater than zero");return n}
function updateButtons(){const ok=!!account&&!!owner&&account.toLowerCase()===owner.toLowerCase();document.querySelectorAll("form button,.actions button").forEach(b=>b.disabled=!ok||busy);el("connect").textContent=account?account.slice(0,6)+"..."+account.slice(-4):"Connect Wallet"}
async function refresh(){
try{message("กำลังอ่านข้อมูลจริงจาก BSC Mainnet...");
const [o,c,f,bps,r,p,next,u,t]=await Promise.all([contract.owner(),contract.companyWallet(),contract.feeWallet(),contract.companyBps(),contract.thbcPerUsdt(),contract.paused(),contract.nextPurchaseId(),contract.usdt(),contract.thbc()]);
owner=o;
const token=new ethers.Contract(t,TOKEN_ABI,readProvider);
const [reserve,decimals]=await Promise.all([token.balanceOf(ADDRESS),token.decimals()]);
const values={owner:o,companyWallet:c,feeWallet:f,usdt:u,thbc:t,rate:fmt(r),companyShare:(Number(bps)/100).toFixed(2)+"%",feeShare:((10000-Number(bps))/100).toFixed(2)+"%",status:p?"PAUSED":"ACTIVE",nextId:next.toString(),reserve:fmt(reserve,Number(decimals))+" THBC"};
for(const [k,v] of Object.entries(values))el(k).textContent=v;
el("rateInput").value=ethers.formatUnits(r,18);el("shareInput").value=String(Number(bps)/100);el("companyInput").value=c;el("feeInput").value=f;
updateButtons();message("อ่านค่าจริงจาก Blockchain สำเร็จ"+(account&&account.toLowerCase()!==o.toLowerCase()?" · กระเป๋าที่เชื่อมต่อไม่ใช่ Owner":""));
}catch(e){message("อ่านข้อมูลไม่สำเร็จ: "+(e.shortMessage||e.message));updateButtons()}}
async function connect(){
try{if(!window.ethereum)throw Error("เปิดผ่าน MetaMask หรือ TokenPocket ที่มี Web3 Wallet");
walletProvider=new ethers.BrowserProvider(window.ethereum);await walletProvider.send("eth_requestAccounts",[]);
const network=await walletProvider.getNetwork();
if(network.chainId!==56n){try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x38"}]})}catch(e){if(e.code===4902){await window.ethereum.request({method:"wallet_addEthereumChain",params:[{chainId:"0x38",chainName:"BNB Smart Chain",nativeCurrency:{name:"BNB",symbol:"BNB",decimals:18},rpcUrls:[RPC],blockExplorerUrls:["https://bscscan.com"]}]})}else throw e}}
walletProvider=new ethers.BrowserProvider(window.ethereum);
signer=await walletProvider.getSigner();account=await signer.getAddress();updateButtons();await refresh();
}catch(e){message("เชื่อมต่อไม่สำเร็จ: "+(e.shortMessage||e.message))}}
async function transact(fn){if(busy)return;try{if(!signer||!account)throw Error("Connect Owner Wallet first");if(!owner||account.toLowerCase()!==owner.toLowerCase())throw Error("Only contract Owner may perform this action");
busy=true;updateButtons();message("โปรดตรวจสอบรายละเอียดและยืนยันธุรกรรมใน Wallet");
const writable=new ethers.Contract(ADDRESS,ABI,signer);const tx=await fn(writable);message("ส่งธุรกรรมแล้ว: "+tx.hash+" · กำลังรอยืนยัน...");await tx.wait();message("ธุรกรรมสำเร็จ: "+tx.hash);await refresh();
}catch(e){message("ธุรกรรมไม่สำเร็จ: "+(e.shortMessage||e.reason||e.message))}finally{busy=false;updateButtons()}}
function bind(id,fn){el(id).addEventListener("submit",e=>{e.preventDefault();transact(fn)})}
bind("rateForm",c=>c.setRate(amount(el("rateInput").value)));
bind("shareForm",c=>{const n=Number(el("shareInput").value);if(!Number.isFinite(n)||n<0||n>100||!Number.isInteger(n*100))throw Error("Share must be 0–100 with at most 2 decimals");return c.setCompanyBps(Math.round(n*100))});
bind("walletForm",c=>c.setWallets(validAddress(el("companyInput").value.trim()),validAddress(el("feeInput").value.trim())));
bind("rewardForm",c=>c.distributeReward(validAddress(el("rewardTo").value.trim()),amount(el("rewardAmount").value)));
bind("withdrawForm",c=>c.withdrawTHBCReserve(validAddress(el("withdrawTo").value.trim()),amount(el("withdrawAmount").value)));
el("pause").onclick=()=>{if(confirm("Pause purchases and sends?"))transact(c=>c.pause())};
el("unpause").onclick=()=>{if(confirm("Unpause contract?"))transact(c=>c.unpause())};
el("connect").onclick=connect;el("refresh").onclick=refresh;el("contractAddr").textContent=ADDRESS;el("scan").href="https://bscscan.com/address/"+ADDRESS;
if(window.ethereum){window.ethereum.on?.("accountsChanged",()=>{account=null;signer=null;updateButtons();message("Wallet account changed. Reconnect to continue.")});window.ethereum.on?.("chainChanged",()=>{account=null;signer=null;updateButtons();message("Network changed. Reconnect to continue.")})}
updateButtons();refresh();
