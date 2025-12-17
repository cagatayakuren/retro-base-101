import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import ImageCropper from "./ImageCropper";
import heic2any from "heic2any";
import { createMoodPack, getCreatorPacks } from "../services/firebaseService";
import { uploadImageToIPFS, uploadMetadataToIPFS, resolveIPFSUri } from "../services/thirdwebService";
import Retro1155Abi from "../abis/Retro1155Abi.json";
import "./Creator.css";

// Contract address
const RETRO1155_CONTRACT_ADDRESS = "0xa95495b0f2e5969a19126a57e740338210dd6a36";

// Base Mainnet Chain ID
const BASE_CHAIN_ID = "0x2105"; // 8453 in hex
const BASE_RPC_URL = "https://base-rpc.publicnode.com";

function Creator({ walletAddress, userProfile }) {
  const [activeTab, setActiveTab] = useState("create"); // 'create' or 'myCreations'
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [cropIndex, setCropIndex] = useState(null);
  const [packName, setPackName] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packPrice, setPackPrice] = useState("1.00");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [myPacks, setMyPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [ipfsUris, setIpfsUris] = useState([]); // IPFS URI'leri
  const [uploadingImage, setUploadingImage] = useState(false);
  const [toast, setToast] = useState(null); // Toast notification
  const MAX_IMAGES = 5;

  // Load creator's packs when wallet changes or tab switches to myCreations
  useEffect(() => {
    const loadMyPacks = async () => {
      if (walletAddress && activeTab === "myCreations") {
        setLoadingPacks(true);
        try {
          const packs = await getCreatorPacks(walletAddress);
          setMyPacks(packs);
        } catch (err) {
          console.error("Error loading packs:", err);
        } finally {
          setLoadingPacks(false);
        }
      }
    };
    loadMyPacks();
  }, [walletAddress, activeTab]);

  // Toast göster ve otomatik kapat
  const showToast = (message, ipfsUri = null) => {
    setToast({ message, ipfsUri, timestamp: Date.now() });
    setTimeout(() => setToast(null), 5000); // 5 saniye sonra kapat
  };

  // Görseli IPFS'e yükle
  const uploadToIPFS = async (dataUrl, index) => {
    try {
      setUploadingImage(true);
      console.log(`Uploading image ${index + 1} to IPFS...`);
      const uri = await uploadImageToIPFS(dataUrl, `mood_image_${index + 1}.jpg`);
      console.log(`Image ${index + 1} uploaded to IPFS:`, uri);
      
      // Gateway URL'ini oluştur
      const gatewayUrl = resolveIPFSUri(uri);
      
      setIpfsUris((prev) => [...prev, uri]);
      setUploadingImage(false);
      
      // Toast göster
      showToast(`Image ${index + 1} uploaded to IPFS!`, gatewayUrl);
      
      return uri;
    } catch (err) {
      console.error("IPFS upload error:", err);
      setError("Failed to upload image to IPFS: " + err.message);
      setUploadingImage(false);
      showToast(`Failed to upload image ${index + 1}: ${err.message}`);
      return null;
    }
  };

  const convertHeicIfNeeded = async (file) => {
    const isHeic =
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");

    if (isHeic) {
      try {
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });
        // heic2any can return array or single blob
        const blob = Array.isArray(convertedBlob)
          ? convertedBlob[0]
          : convertedBlob;
        return new File(
          [blob],
          file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
          {
            type: "image/jpeg",
          }
        );
      } catch (err) {
        console.error("HEIC conversion error:", err);
        throw new Error("Failed to convert HEIC image");
      }
    }
    return file;
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);

    if (selectedImages.length + files.length > MAX_IMAGES) {
      setError(`You can upload maximum ${MAX_IMAGES} images`);
      return;
    }

    for (const file of files) {
      try {
        if (file.size > 5 * 1024 * 1024) {
          setError("Image size should be less than 5MB");
          continue;
        }

        // Convert HEIC to JPEG if needed
        const processedFile = await convertHeicIfNeeded(file);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const img = new Image();
          img.onload = async () => {
            // Check if image needs cropping (larger than 240x280)
            if (img.width > 240 || img.height > 280) {
              setImageToCrop(reader.result);
              setCropIndex(selectedImages.length);
            } else {
              // Önce preview ekle
              setSelectedImages((prev) => [...prev, processedFile]);
              setImagePreviews((prev) => [...prev, reader.result]);
              // Hemen IPFS'e yükle
              await uploadToIPFS(reader.result, selectedImages.length);
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(processedFile);
      } catch (err) {
        setError(err.message || "Failed to process image");
      }
    }
    setError("");
  };

  const handleCropComplete = async (croppedImageUrl) => {
    setSelectedImages((prev) => [...prev, croppedImageUrl]);
    setImagePreviews((prev) => [...prev, croppedImageUrl]);
    setImageToCrop(null);
    setCropIndex(null);
    // Crop tamamlandıktan sonra IPFS'e yükle
    await uploadToIPFS(croppedImageUrl, selectedImages.length);
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
    setCropIndex(null);
  };

  const handleRemoveImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setIpfsUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isHeic =
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif");
      return isImage || isHeic;
    });

    if (selectedImages.length + files.length > MAX_IMAGES) {
      setError(`You can upload maximum ${MAX_IMAGES} images`);
      return;
    }

    for (const file of files) {
      try {
        if (file.size > 5 * 1024 * 1024) {
          setError("Image size should be less than 5MB");
          continue;
        }

        // Convert HEIC to JPEG if needed
        const processedFile = await convertHeicIfNeeded(file);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const img = new Image();
          img.onload = async () => {
            // Check if image needs cropping (larger than 240x280)
            if (img.width > 240 || img.height > 280) {
              setImageToCrop(reader.result);
              setCropIndex(selectedImages.length);
            } else {
              // Önce preview ekle
              setSelectedImages((prev) => [...prev, processedFile]);
              setImagePreviews((prev) => [...prev, reader.result]);
              // Hemen IPFS'e yükle
              await uploadToIPFS(reader.result, selectedImages.length);
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(processedFile);
      } catch (err) {
        setError(err.message || "Failed to process image");
      }
    }
    setError("");
  };

  const handleCreatePack = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (
      selectedImages.length === 0 ||
      !packName ||
      !packDescription ||
      !packPrice
    ) {
      setError("Please fill all required fields and upload at least one image");
      return;
    }

    // Tüm görsellerin IPFS'e yüklendiğini kontrol et
    if (ipfsUris.length !== selectedImages.length) {
      setError("Please wait for all images to finish uploading to IPFS");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      // Step 1: Metadata JSON'u oluştur ve IPFS'e yükle
      console.log("Creating metadata JSON and uploading to IPFS...");
      console.log("Image URIs:", ipfsUris);
      
      let metadataUri;
      try {
        metadataUri = await uploadMetadataToIPFS({
          name: packName,
          description: packDescription,
          price: packPrice,
          images: ipfsUris,
          creator: walletAddress,
        });
        console.log("Metadata uploaded to IPFS:", metadataUri);
      } catch (ipfsError) {
        console.error("Metadata upload failed:", ipfsError);
        throw new Error("Failed to upload metadata to IPFS: " + ipfsError.message);
      }

      // baseUri'yi oluştur (gateway URL)
      const baseUri = resolveIPFSUri(metadataUri);
      console.log("BaseUri:", baseUri);

      // Step 2: Get provider and signer for Base network
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

      // Convert price to USDC format (6 decimals)
      const mintPrice = ethers.parseUnits(packPrice, 6);

      // Call createSeries on the contract with IPFS baseUri
      const tx = await contract.createSeries(
        walletAddress, // creator
        baseUri, // baseUri
        mintPrice // mintPrice (6 decimals)
      );

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      // Get the tokenId from the transaction receipt (from SeriesCreated event)
      let tokenId = null;
      if (receipt.logs && receipt.logs.length > 0) {
        // Parse events from receipt
        for (const log of receipt.logs) {
          try {
            const parsedLog = contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === "SeriesCreated") {
              tokenId = parsedLog.args.tokenId.toString();
              break;
            }
          } catch (e) {
            // Not our event, continue
            continue;
          }
        }
      }

      // If we couldn't get tokenId from event, try to query totalSeries from contract
      if (!tokenId) {
        try {
          const totalSeries = await contract.totalSeries();
          // The new tokenId should be totalSeries - 1 (0-indexed) or totalSeries (1-indexed)
          tokenId = (BigInt(totalSeries) - 1n).toString();
        } catch (e) {
          console.warn("Could not get tokenId from contract:", e);
        }
      }

      // Create mood pack with IPFS URLs and tokenId
      const packData = {
        name: packName,
        description: packDescription,
        price: packPrice,
        images: ipfsUris.map((uri) =>
          uri.replace("ipfs://", "https://ipfs.io/ipfs/")
        ), // IPFS gateway URLs for display
        imageUris: ipfsUris, // Raw IPFS URIs
        metadataUri: metadataUri,
        baseUri: baseUri,
        tokenId: tokenId, // NFT token ID from contract
        contractAddress: RETRO1155_CONTRACT_ADDRESS,
        txHash: receipt.hash,
      };

      const packId = await createMoodPack(walletAddress, packData);

      setSuccess(
        `Mood pack "${packName}" created successfully with ${
          selectedImages.length
        } image${selectedImages.length > 1 ? "s" : ""}! Token ID: ${
          tokenId || "Pending"
        }`
      );

      // Reset form
      setSelectedImages([]);
      setImagePreviews([]);
      setIpfsUris([]);
      setPackName("");
      setPackDescription("");
      setPackPrice("1.00");

      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      console.error("Create pack error:", err);
      if (err.code === 4001) {
        setError(
          "Transaction rejected. Please approve the transaction in your wallet."
        );
      } else if (err.message?.includes("network")) {
        setError("Network error. Please check your connection and try again.");
      } else if (err.message?.includes("IPFS")) {
        setError(err.message);
      } else {
        setError("Failed to create mood pack: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="ipfs-toast">
          <div className="toast-content">
            <div className="toast-icon">✓</div>
            <div className="toast-message">
              <p>{toast.message}</p>
              {toast.ipfsUri && (
                <a
                  href={toast.ipfsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="toast-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  {toast.ipfsUri.length > 60
                    ? toast.ipfsUri.substring(0, 60) + "..."
                    : toast.ipfsUri}
                </a>
              )}
            </div>
            <button
              className="toast-close"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="creator-container">
        <h1 className="page-title">Pack Creator</h1>

        {/* Tab Navigation */}
        <div className="creator-tabs">
          <button
            className={`tab-button ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Create Pack
          </button>
          <button
            className={`tab-button ${
              activeTab === "myCreations" ? "active" : ""
            }`}
            onClick={() => setActiveTab("myCreations")}
          >
            My Creations
          </button>
        </div>

        {activeTab === "create" && (
          <div className="creator-content">
            {/* Upload Section */}
            <div className="upload-section">
              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="images-preview-grid">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="image-preview-item">
                      <img src={preview} alt={`Preview ${index + 1}`} />
                      <button
                        className="remove-image-btn"
                        onClick={() => handleRemoveImage(index)}
x                        disabled={uploadingImage}
                      >
                        ×
                      </button>
                      <span className="image-number">{index + 1}</span>
                      {/* IPFS upload status */}
                      {ipfsUris[index] ? (
                        <span className="ipfs-status uploaded" title={ipfsUris[index]}>✓ IPFS</span>
                      ) : (
                        <span className="ipfs-status uploading">⏳</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Area */}
              {imagePreviews.length < MAX_IMAGES && (
                <div
                  className="upload-area"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <label htmlFor="image-upload" className="upload-label">
                    <div className="upload-icon">📸</div>
                    <h3>Upload Mood Pack Images</h3>
                    <p>Drag & drop or click to select</p>
                    <span className="upload-hint">
                      PNG, JPG, GIF, HEIC up to 5MB • {imagePreviews.length}/
                      {MAX_IMAGES} images
                    </span>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*,.heic,.heif"
                      multiple
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              )}

              {/* Creator Info */}
              {userProfile && (
                <div className="creator-info-card">
                  <div className="creator-avatar">
                    {userProfile.avatar ? (
                      <img
                        src={userProfile.avatar}
                        alt={userProfile.username}
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {userProfile.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="creator-details">
                    <span className="creator-label">CREATOR</span>
                    <span className="creator-name">{userProfile.username}</span>
                    <span className="creator-wallet">
                      {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Form Section */}
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="pack-name">Pack Name *</label>
                <input
                  id="pack-name"
                  type="text"
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder="Enter pack name"
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label htmlFor="pack-description">Description *</label>
                <textarea
                  id="pack-description"
                  value={packDescription}
                  onChange={(e) => setPackDescription(e.target.value)}
                  placeholder="Describe your pack"
                  maxLength={200}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="pack-price">Price (USDC) *</label>
                <input
                  id="pack-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={packPrice}
                  onChange={(e) => setPackPrice(e.target.value)}
                  placeholder="1.00"
                />
              </div>

              {error && <div className="creator-error">{error}</div>}
              {success && <div className="creator-success">{success}</div>}

              <button
                className="create-button"
                onClick={handleCreatePack}
                disabled={
                  isCreating ||
                  uploadingImage ||
                  selectedImages.length === 0 ||
                  ipfsUris.length !== selectedImages.length ||
                  !packName ||
                  !packDescription ||
                  !packPrice
                }
              >
                {isCreating
                  ? "Creating..."
                  : uploadingImage
                  ? "Uploading to IPFS..."
                  : ipfsUris.length !== selectedImages.length
                  ? "Waiting for IPFS upload..."
                  : `Create Mood Pack ${
                      selectedImages.length > 0
                        ? `(${selectedImages.length} image${
                            selectedImages.length > 1 ? "s" : ""
                          })`
                        : ""
                    }`}
              </button>

              <p className="creator-note">
                Your mood pack will be minted as an NFT and listed on the
                marketplace.
              </p>
            </div>
          </div>
        )}

        {/* My Creations Tab */}
        {activeTab === "myCreations" && (
          <div className="my-creations-content">
            {loadingPacks ? (
              <div className="loading-packs">
                <div className="loading-spinner"></div>
                <p>Loading your packs...</p>
              </div>
            ) : myPacks.length === 0 ? (
              <div className="no-packs-created">
                <div className="no-packs-icon">📦</div>
                <h3>No Packs Created Yet</h3>
                <p>Create your first mood pack to see it here!</p>
                <button
                  className="switch-to-create-btn"
                  onClick={() => setActiveTab("create")}
                >
                  Create Pack
                </button>
              </div>
            ) : (
              <div className="my-packs-grid">
                {myPacks.map((pack) => (
                  <div key={pack.id} className="my-pack-card">
                    <div className="my-pack-image-container">
                      {pack.images && pack.images.length > 1 ? (
                        <div className="multi-image-preview">
                          {pack.images.slice(0, 4).map((img, idx) => (
                            <div key={idx} className="mini-image">
                              <img src={img} alt={`${pack.name} ${idx + 1}`} />
                            </div>
                          ))}
                          {pack.images.length > 4 && (
                            <div className="more-count">
                              +{pack.images.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <img
                          src={pack.images[0] || pack.image}
                          alt={pack.name}
                          className="my-pack-image"
                        />
                      )}
                    </div>
                    <div className="my-pack-info">
                      <h3 className="my-pack-name">{pack.name}</h3>
                      <p className="my-pack-description">{pack.description}</p>
                      <div className="my-pack-footer">
                        <div className="my-pack-price">
                          <span className="price-label">PRICE</span>
                          <span className="price-value">{pack.price} USDC</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default Creator;
