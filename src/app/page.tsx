"use client";

import { useState, useEffect } from "react";
import { web3Service, Model, InferenceLog } from "./web3";

// Simple fallback classifier in case HuggingFace model loading is skipped or offline
const runFallbackInference = (text: string) => {
  const positiveWords = ["love", "great", "perfect", "good", "happy", "awesome", "beautiful", "easy", "fun", "best", "amazing", "wow", "yes"];
  const negativeWords = ["bad", "hate", "slow", "error", "fail", "difficult", "hard", "worse", "broken", "annoying", "no", "useless"];
  
  let score = 0.5;
  const words = text.toLowerCase().split(/\s+/);
  
  words.forEach(w => {
    if (positiveWords.includes(w)) score += 0.15;
    if (negativeWords.includes(w)) score -= 0.15;
  });
  
  score = Math.max(0.01, Math.min(0.99, score));
  const label = score >= 0.5 ? "POSITIVE" : "NEGATIVE";
  const confidence = score >= 0.5 ? score : 1 - score;
  
  return { label, score: parseFloat(confidence.toFixed(4)) };
};

// Compute SHA-256 hash using native Web Crypto API
const computeSha256 = async (text: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
};

export default function Home() {
  // Web3 state
  const [isMock, setIsMock] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [tokenBalance, setTokenBalance] = useState("0.00");
  const [models, setModels] = useState<Model[]>([]);
  const [inferences, setInferences] = useState<InferenceLog[]>([]);
  
  // Model registration state
  const [newModelName, setNewModelName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  
  // ML Inference state
  const [selectedModel, setSelectedModel] = useState("");
  const [inputText, setInputText] = useState("");
  const [mlResult, setMlResult] = useState<{ label: string; score: number } | null>(null);
  const [proofHash, setProofHash] = useState("");
  const [isMlLoading, setIsMlLoading] = useState(false);
  const [isRealMlMode, setIsRealMlMode] = useState(false);
  const [mlStatusMsg, setMlStatusMsg] = useState("");
  
  // On-chain logging state
  const [isLogging, setIsLogging] = useState(false);
  const [isVerifying, setIsVerifying] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  const filteredInferences = inferences.filter(log => {
    const query = searchFilter.toLowerCase();
    return (
      log.modelName.toLowerCase().includes(query) ||
      log.inputData.toLowerCase().includes(query) ||
      log.outputData.toLowerCase().includes(query) ||
      log.proofHash.toLowerCase().includes(query) ||
      log.submitter.toLowerCase().includes(query)
    );
  });

  // Load initial blockchain values
  const refreshBlockchainData = async () => {
    const mockState = web3Service.isMocking();
    setIsMock(mockState);
    
    const address = await web3Service.getAddress();
    setWalletAddress(address);
    
    const balance = await web3Service.getTokenBalance(address);
    setTokenBalance(balance);
    
    const fetchedModels = await web3Service.getModels();
    setModels(fetchedModels);
    if (fetchedModels.length > 0 && !selectedModel) {
      setSelectedModel(fetchedModels[0].name);
    }
    
    const fetchedInferences = await web3Service.getInferences();
    setInferences(fetchedInferences);
  };

  useEffect(() => {
    refreshBlockchainData();
    const interval = setInterval(refreshBlockchainData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRegisterModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;
    
    setIsRegistering(true);
    try {
      await web3Service.registerModel(newModelName.trim());
      setNewModelName("");
      await refreshBlockchainData();
    } catch (err) {
      alert("Error registering model. Check console.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRunInference = async () => {
    if (!inputText.trim()) return;
    setIsMlLoading(true);
    setMlResult(null);
    setProofHash("");

    if (isRealMlMode) {
      setMlStatusMsg("Loading Transformers.js and downloading model pipeline (client-side)...");
      try {
        const { pipeline } = await import("@huggingface/transformers");
        const classifier = await pipeline(
          "sentiment-analysis", 
          "Xenova/tiny-random-DistilBertForSequenceClassification"
        );
        
        setMlStatusMsg("Executing in-browser tensor calculations...");
        const result = await classifier(inputText);
        
        const prediction = result[0];
        const formattedResult = {
          label: prediction.label,
          score: parseFloat(prediction.score.toFixed(4))
        };
        
        setMlResult(formattedResult);
        
        const payload = `${selectedModel}:${inputText}:${formattedResult.label}`;
        const hash = await computeSha256(payload);
        setProofHash(hash);
        setMlStatusMsg("");
      } catch (err) {
        console.error("Transformers.js failed, falling back to local classifier", err);
        setMlStatusMsg("Transformers.js loading failed. Using local text model...");
        setTimeout(async () => {
          const res = runFallbackInference(inputText);
          setMlResult(res);
          const hash = await computeSha256(`${selectedModel}:${inputText}:${res.label}`);
          setProofHash(hash);
          setMlStatusMsg("");
        }, 800);
      } finally {
        setIsMlLoading(false);
      }
    } else {
      setMlStatusMsg("Executing instant local classification...");
      setTimeout(async () => {
        const res = runFallbackInference(inputText);
        setMlResult(res);
        const hash = await computeSha256(`${selectedModel}:${inputText}:${res.label}`);
        setProofHash(hash);
        setIsMlLoading(false);
        setMlStatusMsg("");
      }, 300);
    }
  };

  const handleSubmitOnChain = async () => {
    if (!selectedModel || !inputText || !mlResult || !proofHash) return;
    
    setIsLogging(true);
    try {
      await web3Service.logInference(
        selectedModel,
        inputText,
        mlResult.label,
        proofHash
      );
      setInputText("");
      setMlResult(null);
      setProofHash("");
      await refreshBlockchainData();
    } catch (err) {
      alert("Failed to submit transaction to the block.");
    } finally {
      setIsLogging(false);
    }
  };

  const handleVerifyInference = async (id: number, isCorrect: boolean) => {
    setIsVerifying(id);
    try {
      await web3Service.verifyInference(id, isCorrect);
      await refreshBlockchainData();
    } catch (err) {
      alert("Failed to confirm verification.");
    } finally {
      setIsVerifying(null);
    }
  };

  return (
    <main style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Background Decorative Glow Orbs */}
      <div className="glow-orb glow-orb-1"></div>
      <div className="glow-orb glow-orb-2"></div>
      <div className="glow-orb glow-orb-3"></div>

      <div className="container">
        {/* Header section */}
        <header className="header">
          <div className="title-section">
            <h1>Proof of Verifiable Inference</h1>
            <p>
              Decentralized machine learning nodes logging client-side tensor execution proofs on-chain.
            </p>
          </div>
          
          <div className="web3-status">
            <span className={`status-dot ${isMock ? "" : "active"}`}></span>
            <span>
              {isMock ? "Simulated Network (Offline)" : "Hardhat Node (Connected)"}
            </span>
          </div>
        </header>

        {/* Bento Grid Dashboard */}
        <div className="bento-grid">
          
          {/* Connection status card */}
          <section className="card col-4">
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Registry Parameters
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Local RPC Host</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--primary)", marginTop: "2px" }}>http://127.0.0.1:8545</p>
              </div>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Registry Contract Address</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.80rem", marginTop: "2px", wordBreak: "break-all" }}>0x5FbDB2315678afecb367f032d93F642f64180aa3</p>
              </div>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reward Token Contract ($INF)</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.80rem", marginTop: "2px", wordBreak: "break-all" }}>0xa16E02E87b7454126E5E10d957A927A7F5B5d2be</p>
              </div>
              {isMock && (
                <div style={{ background: "rgba(245, 158, 11, 0.04)", padding: "12px", borderRadius: "14px", border: "1px dashed rgba(245, 158, 11, 0.2)", marginTop: "4px" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--warning)", lineHeight: "1.4" }}>
                    💡 Simulated offline mode active. Run <code>npx hardhat node</code> and deploy to enable live transaction recording.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Node Wallet Balance Card */}
          <section className="card col-4">
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--secondary)" }}><rect width="20" height="14" x="2" y="5" rx="2" ry="2"/><path d="M12 11h.01M17 11h.01M19 5v14M5 5v14"/></svg>
              Node Ledger
            </h2>
            
            <div className="wallet-card">
              <div className="wallet-chip"></div>
              <span className="wallet-label">Balance</span>
              <div className="wallet-balance">
                <span>{tokenBalance}</span>
                <span style={{ fontSize: "1.3rem", color: "var(--secondary)" }}>INF</span>
              </div>
              <div style={{ marginTop: "24px" }}>
                <span className="wallet-label">Wallet Private Key Account</span>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                  {walletAddress}
                </p>
              </div>
            </div>
          </section>

          {/* Quick Model Registration Card */}
          <section className="card col-4">
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success)" }}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v8M8 12h8"/></svg>
              Register Node Model
            </h2>
            <form onSubmit={handleRegisterModel} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
              <div className="input-group" style={{ marginBottom: "0" }}>
                <label className="input-label">Model Name / Identifier</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. text-classifier-distilbert"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  disabled={isRegistering}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isRegistering || !newModelName.trim()}
                style={{ width: "100%", marginTop: "4px" }}
              >
                {isRegistering ? "Registering on-chain..." : "Register Model"}
              </button>
            </form>
          </section>

          {/* Main inference execution workspace */}
          <section className="card col-7">
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Inference Workspace
            </h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div className="input-group" style={{ marginBottom: "0" }}>
                <label className="input-label">Target Model</label>
                <select 
                  className="text-input"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ appearance: "auto" }}
                >
                  {models.length === 0 ? (
                    <option value="">No models registered</option>
                  ) : (
                    models.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))
                  )}
                </select>
              </div>
              
              <div className="input-group" style={{ marginBottom: "0" }}>
                <label className="input-label">Calculation Mode</label>
                <div className="toggle-slider-container">
                  <button
                    type="button"
                    className={`toggle-slider-btn ${!isRealMlMode ? "active" : ""}`}
                    onClick={() => setIsRealMlMode(false)}
                  >
                    ⚡ Mock Mode
                  </button>
                  <button
                    type="button"
                    className={`toggle-slider-btn ${isRealMlMode ? "active" : ""}`}
                    onClick={() => setIsRealMlMode(true)}
                  >
                    🧬 Real ML
                  </button>
                </div>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Input Prompt / Payload Text</label>
              <textarea
                className="text-input"
                rows={3}
                placeholder="Enter string parameters to calculate inference..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isMlLoading || isLogging}
                style={{ resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", gap: "14px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-outline"
                onClick={handleRunInference}
                disabled={!inputText.trim() || isMlLoading || models.length === 0}
              >
                {isMlLoading ? "Computing Tensor..." : "Run Client Inference"}
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSubmitOnChain}
                disabled={!mlResult || isLogging || !proofHash}
              >
                {isLogging ? "Broadcasting..." : "Submit Proof On-Chain"}
              </button>
            </div>

            {/* In-progress loader */}
            {isMlLoading && (
              <div style={{ marginTop: "16px" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--primary)", fontStyle: "italic" }}>
                  {mlStatusMsg}
                </p>
                <div className="loader-bar">
                  <div className="loader-bar-fill"></div>
                </div>
              </div>
            )}

            {/* Inference Result Output Card */}
            {mlResult && (
              <div className="terminal-readout" style={{ marginTop: "24px", padding: "24px", borderRadius: "16px" }}>
                <div className="terminal-readout-header">
                  node_inference_receipt_log.sh
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>[METRIC: Sentiment Class]</span>
                    <p style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "6px", color: mlResult.label === "POSITIVE" ? "var(--success)" : "var(--error)" }}>
                      {mlResult.label}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>[METRIC: Execution Confidence]</span>
                    <p style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "6px", color: "var(--text-primary)" }}>
                      {(mlResult.score * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>[SIGNATURE: Tamper-proof Proof (SHA-256)]</span>
                    <button 
                      className="copy-hash-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(proofHash);
                        alert("Proof hash copied to clipboard!");
                      }}
                      title="Copy proof signature"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>
                  </div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", wordBreak: "break-all", background: "rgba(0,0,0,0.4)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.04)", marginTop: "8px", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <span>{proofHash}</span>
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Leaderboard / Active models list */}
          <section className="card col-5">
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--secondary)" }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Active Node Rankings
            </h2>
            <div style={{ overflowY: "auto", maxHeight: "310px", marginTop: "8px" }}>
              {models.length === 0 ? (
                <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0", fontSize: "0.9rem" }}>No active nodes registered.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {models.map((m, idx) => {
                    const accuracy = m.totalInferences > 0 
                      ? (Number(m.correctInferences) / Number(m.totalInferences)) * 100
                      : 100;
                    return (
                      <div key={m.name} style={{ background: "rgba(0, 0, 0, 0.12)", border: "1px solid var(--border-color)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                width: "20px", 
                                height: "20px", 
                                borderRadius: "50%", 
                                fontSize: "0.75rem", 
                                fontWeight: "bold",
                                background: idx === 0 ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : idx === 1 ? "linear-gradient(135deg, #94a3b8, #64748b)" : "rgba(255, 255, 255, 0.1)",
                                color: idx < 2 ? "#000" : "var(--text-secondary)"
                              }}>
                                {idx + 1}
                              </span>
                              <h4 style={{ fontWeight: 700, fontSize: "0.95rem" }}>{m.name}</h4>
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", display: "block", marginTop: "4px" }}>
                              Owner: {m.owner.substring(0, 6)}...{m.owner.substring(38)}
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--success)" }}>
                              {accuracy.toFixed(1)}% Accuracy
                            </p>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                              {Number(m.correctInferences)}/{Number(m.totalInferences)} verified
                            </span>
                          </div>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${accuracy}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Global transaction log / Validator Console */}
          <section className="card col-12">
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success)" }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              On-Chain Verification Console
            </h2>
            
            <div className="console-actions-bar">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0 }}>
                Simulated validation nodes auditing prediction proofs to trigger automated smart contract reward minting.
              </p>
              <input
                type="text"
                className="console-search-input"
                placeholder="Search console logs..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>

            <div className="log-table-wrapper">
              {filteredInferences.length === 0 ? (
                <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0", fontSize: "0.9rem" }}>
                  {inferences.length === 0 
                    ? "No transaction hashes recorded in ledger. Run a prompt calculation to log proofs." 
                    : "No matching records found for search filter."}
                </p>
              ) : (
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Model Node</th>
                      <th>Input Parameters</th>
                      <th>Prediction</th>
                      <th>Proof Hash</th>
                      <th>Submitter</th>
                      <th>Audit Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInferences.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>#{log.id}</td>
                        <td style={{ fontWeight: 700 }}>{log.modelName}</td>
                        <td title={log.inputData} style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.inputData}
                        </td>
                        <td>
                          <span className={`badge ${log.outputData === "POSITIVE" ? "badge-success" : "badge-error"}`}>
                            {log.outputData}
                          </span>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)" }} title={log.proofHash}>
                          {log.proofHash.substring(0, 10)}...
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {log.submitter.substring(0, 6)}...{log.submitter.substring(38)}
                        </td>
                        <td>
                          {log.verified ? (
                            log.isCorrect ? (
                              <span className="badge badge-success">✓ Correct</span>
                            ) : (
                              <span className="badge badge-error">✗ Incorrect</span>
                            )
                          ) : (
                            <span className="badge badge-pending">⚡ Auditing</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {!log.verified ? (
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                              <button
                                className="btn btn-approve"
                                onClick={() => handleVerifyInference(log.id, true)}
                                disabled={isVerifying === log.id}
                                style={{ padding: "8px 14px", fontSize: "0.8rem", borderRadius: "10px" }}
                              >
                                {isVerifying === log.id ? "..." : "Approve & Mint"}
                              </button>
                              <button
                                className="btn btn-reject"
                                onClick={() => handleVerifyInference(log.id, false)}
                                disabled={isVerifying === log.id}
                                style={{ padding: "8px 14px", fontSize: "0.8rem", borderRadius: "10px" }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Closed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
