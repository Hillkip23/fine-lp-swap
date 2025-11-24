"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";

// ====== CHAIN + ADDRESSES ======
const CHAIN_ID = 11155111; // Sepolia
const FINE5_ADDRESS = "0x0FB987BEE67FD839cb1158B0712d5e4Be483dd2E";
const FINE6_ADDRESS = "0xe051C1eA47b246c79f3bac4e58E459cF2Aa20692";
const POOL_ADDRESS = "0x0Bf78f76c86153E433dAA5Ac6A88453D30968e27";

// ====== ABIs (only needed functions) ======
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
];

const POOL_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function reserve0() view returns (uint112)",
  "function reserve1() view returns (uint112)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function addLiquidity(uint256 amount0, uint256 amount1) returns (uint256)",
  "function removeLiquidity(uint256 lpAmount) returns (uint256,uint256)",
  "function swapExact0For1(uint256 amount0In, uint256 min1Out) returns (uint256)",
  "function swapExact1For0(uint256 amount1In, uint256 min0Out) returns (uint256)",
];

type SwapDirection = "0to1" | "1to0";

export default function HomePage() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [networkOk, setNetworkOk] = useState<boolean>(false);

  const [fine5, setFine5] = useState<ethers.Contract | null>(null);
  const [fine6, setFine6] = useState<ethers.Contract | null>(null);
  const [pool, setPool] = useState<ethers.Contract | null>(null);

  const [balances, setBalances] = useState({
    fine5: 0,
    fine6: 0,
    lp: 0,
  });

  const [reserves, setReserves] = useState({
    reserve0: 0,
    reserve1: 0,
  });

  const [swapDirection, setSwapDirection] = useState<SwapDirection>("0to1");
  const [swapAmount, setSwapAmount] = useState<string>("");

  const [addAmount0, setAddAmount0] = useState<string>("");
  const [addAmount1, setAddAmount1] = useState<string>("");

  const [removeLpAmount, setRemoveLpAmount] = useState<string>("");

  const [status, setStatus] = useState<string>("");

  // ---------- CONNECT WALLET ----------
  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask not found");
      return;
    }

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      setNetworkOk(false);
      setStatus("Please switch MetaMask to Sepolia network.");
    } else {
      setNetworkOk(true);
      setStatus("");
    }

    setProvider(provider);
    setSigner(signer);
    setAccount(accounts[0]);

    const f5 = new ethers.Contract(FINE5_ADDRESS, ERC20_ABI, signer);
    const f6 = new ethers.Contract(FINE6_ADDRESS, ERC20_ABI, signer);
    const p = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);

    setFine5(f5);
    setFine6(f6);
    setPool(p);
  };

  // ---------- LOAD BALANCES & RESERVES ----------
  const refreshData = async () => {
    if (!signer || !fine5 || !fine6 || !pool) return;
    try {
      const addr = await signer.getAddress();

      const [b5, b6, lp, r0, r1] = await Promise.all([
        fine5.balanceOf(addr),
        fine6.balanceOf(addr),
        pool.balanceOf(addr),
        pool.reserve0(),
        pool.reserve1(),
      ]);

      setBalances({
        fine5: Number(b5),
        fine6: Number(b6),
        lp: Number(lp),
      });

      setReserves({
        reserve0: Number(r0),
        reserve1: Number(r1),
      });
    } catch (err) {
      console.error(err);
      setStatus("Error loading balances/reserves (see console).");
    }
  };

  useEffect(() => {
    if (signer && fine5 && fine6 && pool) {
      void refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, fine5, fine6, pool]);

  // ---------- HELPERS ----------
  const ensureAllowance = async (
    token: ethers.Contract,
    owner: string,
    spender: string,
    amount: bigint
  ) => {
    const current: bigint = await token.allowance(owner, spender);
    if (current >= amount) return;
    setStatus("Approving token spend...");
    const tx = await token.approve(spender, amount);
    await tx.wait();
  };

  // ---------- SWAP ----------
  const handleSwap = async () => {
    if (!pool || !fine5 || !fine6 || !signer) return;
    if (!swapAmount || Number(swapAmount) <= 0) return;

    try {
      const addr = await signer.getAddress();
      const amountIn = BigInt(swapAmount); // tokens have 0 decimals

      // constant-product with 0.30% fee (30 bps)
      const reserveIn =
        swapDirection === "0to1"
          ? BigInt(reserves.reserve0)
          : BigInt(reserves.reserve1);
      const reserveOut =
        swapDirection === "0to1"
          ? BigInt(reserves.reserve1)
          : BigInt(reserves.reserve0);

      const feeBps = BigInt(30); // 0.30%
      const scale = BigInt(10000);

      const amountInWithFee = amountIn * (scale - feeBps);
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn * scale + amountInWithFee;
      const amountOut = denominator === BigInt(0) ? BigInt(0) : numerator / denominator;

      console.log("Simulated amountOut:", amountOut.toString());

      if (swapDirection === "0to1") {
        // FINE5 -> FINE6
        await ensureAllowance(fine5, addr, POOL_ADDRESS, amountIn);
        setStatus("Swapping FINE5 → FINE6...");
        const tx = await pool.swapExact0For1(amountIn, BigInt(0));
        await tx.wait();
      } else {
        // FINE6 -> FINE5
        await ensureAllowance(fine6, addr, POOL_ADDRESS, amountIn);
        setStatus("Swapping FINE6 → FINE5...");
        const tx = await pool.swapExact1For0(amountIn, BigInt(0));
        await tx.wait();
      }

      setStatus("Swap complete ✅");
      setSwapAmount("");
      void refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Swap failed (see console).");
    }
  };

  // ---------- ADD LIQUIDITY ----------
  const handleAddLiquidity = async () => {
    if (!pool || !fine5 || !fine6 || !signer) return;
    if (!addAmount0 || !addAmount1) return;

    try {
      const addr = await signer.getAddress();
      const amount0 = BigInt(addAmount0);
      const amount1 = BigInt(addAmount1);

      await ensureAllowance(fine5, addr, POOL_ADDRESS, amount0);
      await ensureAllowance(fine6, addr, POOL_ADDRESS, amount1);

      setStatus("Adding liquidity...");
      const tx = await pool.addLiquidity(amount0, amount1);
      await tx.wait();

      setStatus("Liquidity added ✅");
      setAddAmount0("");
      setAddAmount1("");
      void refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Add liquidity failed (see console).");
    }
  };

  // ---------- REMOVE LIQUIDITY ----------
  const handleRemoveLiquidity = async () => {
    if (!pool || !signer) return;
    if (!removeLpAmount || Number(removeLpAmount) <= 0) return;

    try {
      const lp = BigInt(removeLpAmount);
      setStatus("Removing liquidity...");
      const tx = await pool.removeLiquidity(lp);
      await tx.wait();

      setStatus("Liquidity removed ✅");
      setRemoveLpAmount("");
      void refreshData();
    } catch (err) {
      console.error(err);
      setStatus("Remove liquidity failed (see console).");
    }
  };

  // ---------- PRICES (display only, JS numbers) ----------
  const price0in1 =
    reserves.reserve0 > 0 && reserves.reserve1 > 0
      ? reserves.reserve1 / reserves.reserve0
      : 0;
  const price1in0 =
    reserves.reserve1 > 0 && reserves.reserve0 > 0
      ? reserves.reserve0 / reserves.reserve1
      : 0;

  // ---------- UI ----------
  return (
    <div style={{ minHeight: "100vh", background: "#070B16", color: "white" }}>
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "2rem 1rem 4rem",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <h1 style={{ fontSize: "1.8rem", fontWeight: 600 }}>
            FINE Swap (FINE5 / FINE6)
          </h1>
          <button
            onClick={connectWallet}
            style={{
              background:
                account && networkOk
                  ? "linear-gradient(90deg,#4ade80,#22c55e)"
                  : "#2563eb",
              border: "none",
              borderRadius: "999px",
              padding: "0.6rem 1.4rem",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {account
              ? networkOk
                ? `${account.slice(0, 6)}...${account.slice(-4)}`
                : "Wrong network"
              : "Connect Wallet"}
          </button>
        </header>

        {status && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              background: "#111827",
              border: "1px solid #1f2937",
              fontSize: "0.9rem",
            }}
          >
            {status}
          </div>
        )}

        {/* Balances & Reserves */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              borderRadius: "1rem",
              background: "#0b1220",
              border: "1px solid #1f2937",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
              Your Balances
            </h2>
            <p>FINE5: {balances.fine5}</p>
            <p>FINE6: {balances.fine6}</p>
            <p>LP (F5F6-LP): {balances.lp}</p>
          </div>
          <div
            style={{
              padding: "1rem",
              borderRadius: "1rem",
              background: "#0b1220",
              border: "1px solid #1f2937",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
              Pool Reserves
            </h2>
            <p>reserve0 (FINE5): {reserves.reserve0}</p>
            <p>reserve1 (FINE6): {reserves.reserve1}</p>
            <p style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
              1 FINE5 ≈ {price0in1.toFixed(4)} FINE6
              <br />
              1 FINE6 ≈ {price1in0.toFixed(4)} FINE5
            </p>
          </div>
        </section>

        {/* Swap + Liquidity */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.7fr) minmax(0,1.3fr)",
            gap: "1.5rem",
            alignItems: "flex-start",
          }}
        >
          {/* Swap */}
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "1.25rem",
              background: "#020617",
              border: "1px solid #1f2937",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Swap</h2>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.9rem" }}>Direction</label>
              <select
                value={swapDirection}
                onChange={(e) =>
                  setSwapDirection(e.target.value as SwapDirection)
                }
                style={{
                  width: "100%",
                  marginTop: "0.25rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "white",
                }}
              >
                <option value="0to1">FINE5 → FINE6</option>
                <option value="1to0">FINE6 → FINE5</option>
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.9rem" }}>Amount in</label>
              <input
                type="number"
                min={0}
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                placeholder="0"
                style={{
                  width: "100%",
                  marginTop: "0.25rem",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "white",
                }}
              />
            </div>

            <button
              onClick={handleSwap}
              disabled={!account || !networkOk}
              style={{
                width: "100%",
                padding: "0.7rem",
                borderRadius: "999px",
                border: "none",
                background:
                  !account || !networkOk
                    ? "#4b5563"
                    : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                color: "white",
                fontWeight: 600,
                cursor: !account || !networkOk ? "not-allowed" : "pointer",
              }}
            >
              {account && networkOk ? "Swap" : "Connect wallet first"}
            </button>
          </div>

          {/* Add / Remove Liquidity */}
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "1.25rem",
              background: "#020617",
              border: "1px solid #1f2937",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              Liquidity
            </h2>

            {/* Add */}
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                Add Liquidity
              </h3>
              <div style={{ marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.9rem" }}>FINE5 amount</label>
                <input
                  type="number"
                  min={0}
                  value={addAmount0}
                  onChange={(e) => setAddAmount0(e.target.value)}
                  placeholder="0"
                  style={{
                    width: "100%",
                    marginTop: "0.25rem",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #374151",
                    background: "#020617",
                    color: "white",
                  }}
                />
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.9rem" }}>FINE6 amount</label>
                <input
                  type="number"
                  min={0}
                  value={addAmount1}
                  onChange={(e) => setAddAmount1(e.target.value)}
                  placeholder="0"
                  style={{
                    width: "100%",
                    marginTop: "0.25rem",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #374151",
                    background: "#020617",
                    color: "white",
                  }}
                />
              </div>

              <button
                onClick={handleAddLiquidity}
                disabled={!account || !networkOk}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: "999px",
                  border: "none",
                  background:
                    !account || !networkOk
                      ? "#4b5563"
                      : "linear-gradient(90deg,#22c55e,#16a34a)",
                  color: "white",
                  fontWeight: 600,
                  cursor: !account || !networkOk ? "not-allowed" : "pointer",
                  marginBottom: "1rem",
                }}
              >
                {account && networkOk ? "Add Liquidity" : "Connect wallet first"}
              </button>
            </div>

            {/* Remove */}
            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                Remove Liquidity
              </h3>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.9rem" }}>LP amount</label>
                <input
                  type="number"
                  min={0}
                  value={removeLpAmount}
                  onChange={(e) => setRemoveLpAmount(e.target.value)}
                  placeholder="0"
                  style={{
                    width: "100%",
                    marginTop: "0.25rem",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #374151",
                    background: "#020617",
                    color: "white",
                  }}
                />
              </div>

              <button
                onClick={handleRemoveLiquidity}
                disabled={!account || !networkOk}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: "999px",
                  border: "none",
                  background:
                    !account || !networkOk
                      ? "#4b5563"
                      : "linear-gradient(90deg,#f97316,#ea580c)",
                  color: "white",
                  fontWeight: 600,
                  cursor: !account || !networkOk ? "not-allowed" : "pointer",
                }}
              >
                {account && networkOk
                  ? "Remove Liquidity"
                  : "Connect wallet first"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

