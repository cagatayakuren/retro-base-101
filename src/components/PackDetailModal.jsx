import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import RetroDevice from "./RetroDevice";
import Retro1155Abi from "../abis/Retro1155Abi.json";
import "./PackDetailModal.css";

// Contract address
const RETRO1155_CONTRACT_ADDRESS = "0xa95495b0f2e5969a19126a57e740338210dd6a36";

// Base Mainnet Chain ID
const BASE_CHAIN_ID = "0x2105"; // 8453 in hex
const BASE_RPC_URL = "https://base-rpc.publicnode.com";

function PackDetailModal({
  pack,
  onClose,
  onPurchase,
  walletAddress,
  isPurchasing,
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [showWalletWarning, setShowWalletWarning] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState(null);

  // Pack'in görselleri - tek görsel veya çoklu
  const images = pack.images || [pack.image];

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Escape tuşu ile kapatma
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Body scroll'u engelle modal açıkken
  useEffect(() => {
    // Scroll pozisyonunu kaydet
    const scrollY = window.scrollY;

    // Body'yi sabitle
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      // Body'yi normale döndür ve scroll pozisyonunu geri yükle
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrevious();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="modal-body">
          {/* Top Section: Device + Info */}
          <div className="modal-top-section">
            {/* Retro Device with Navigation */}
            <div className="modal-device-wrapper">
              {images.length > 1 && (
                <button
                  className="device-nav-btn device-nav-prev"
                  onClick={handlePrevious}
                >
                  ‹
                </button>
              )}

              <div
                className="modal-device-section"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <RetroDevice
                  showControls={false}
                  nftImage={images[currentImageIndex]}
                  ledHue={30}
                  imageObjectFit="cover"
                />

                {/* Dots Indicator */}
                {images.length > 1 && (
                  <div className="device-dots">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        className={`device-dot ${
                          index === currentImageIndex ? "active" : ""
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <button
                  className="device-nav-btn device-nav-next"
                  onClick={handleNext}
                >
                  ›
                </button>
              )}
            </div>

            {/* Pack Name and Creator */}
            <div className="modal-pack-info">
              <h2 className="modal-pack-name">{pack.name}</h2>
              <p className="modal-pack-creator">
                created by{" "}
                {pack.creator.username ||
                  `${pack.creator.wallet.slice(
                    0,
                    6
                  )}...${pack.creator.wallet.slice(-4)}`}
              </p>
            </div>
          </div>

          {/* Bottom Section: Buy Button */}
          <div className="modal-info-section">
            {/* Buy Button */}
            <button
              className={`modal-buy-button ${
                isPurchasing || isMinting ? "purchasing" : ""
              }`}
              onClick={async () => {
                if (!walletAddress) {
                  setShowWalletWarning(true);
                  return;
                }

                setShowWalletWarning(false);
                setMintError(null);
                setIsMinting(true);

                try {
                  // Get provider and signer for Base network
                  let provider = null;
                  if (window.base && window.base.ethereum) {
                    provider = window.base.ethereum;
                  } else if (window.ethereum) {
                    // Check if on Base network
                    const currentChainId = await window.ethereum.request({
                      method: "eth_chainId",
                    });
                    if (currentChainId !== BASE_CHAIN_ID) {
                      try {
                        await window.ethereum.request({
                          method: "wallet_switchEthereumChain",
                          params: [{ chainId: BASE_CHAIN_ID }],
                        });
                      } catch (switchError) {
                        if (switchError.code === 4902) {
                          await window.ethereum.request({
                            method: "wallet_addEthereumChain",
                            params: [
                              {
                                chainId: BASE_CHAIN_ID,
                                rpcUrls: [BASE_RPC_URL],
                                chainName: "Base Mainnet",
                                nativeCurrency: {
                                  name: "Ether",
                                  symbol: "ETH",
                                  decimals: 18,
                                },
                                blockExplorerUrls: ["https://basescan.org"],
                              },
                            ],
                          });
                        } else {
                          throw new Error(
                            "Please approve switching to the Base network in your wallet."
                          );
                        }
                      }
                    }
                    provider = window.ethereum;
                  } else {
                    throw new Error(
                      "Base wallet not found. Please use Base App or install Base wallet."
                    );
                  }

                  const ethersProvider = new ethers.BrowserProvider(provider);
                  const signer = await ethersProvider.getSigner();

                  // Create contract instance
                  const contract = new ethers.Contract(
                    RETRO1155_CONTRACT_ADDRESS,
                    Retro1155Abi,
                    signer
                  );

                  // Get tokenId from pack
                  const tokenId = pack.tokenId;
                  const amount = 1; // Mint 1 NFT

                  if (tokenId === null || tokenId === undefined) {
                    throw new Error("Token ID not found for this pack");
                  }

                  // Call mint function
                  const tx = await contract.mint(tokenId, amount);

                  // Wait for transaction confirmation
                  const receipt = await tx.wait();

                  // Call onPurchase callback if provided
                  if (onPurchase) {
                    onPurchase(pack);
                  }
                } catch (err) {
                  console.error("Mint error:", err);
                  if (err.code === 4001) {
                    setMintError(
                      "Transaction rejected. Please approve the transaction in your wallet."
                    );
                  } else if (err.message?.includes("network")) {
                    setMintError(
                      "Network error. Please check your connection and try again."
                    );
                  } else {
                    setMintError(
                      "Failed to mint NFT: " +
                        (err.message || err.reason || "Unknown error")
                    );
                  }
                } finally {
                  setIsMinting(false);
                }
              }}
              disabled={isPurchasing || isMinting}
            >
              {isPurchasing || isMinting ? "Minting..." : `Buy`}
            </button>

            {/* Wallet warning container - fixed height to prevent layout shift */}
            <div className="modal-wallet-warning-container">
              {showWalletWarning && !walletAddress && (
                <div className="modal-wallet-warning">
                  Please connect your wallet to purchase
                </div>
              )}
              {mintError && (
                <div
                  className="modal-wallet-warning"
                  style={{ color: "#ff4444" }}
                >
                  {mintError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PackDetailModal;
