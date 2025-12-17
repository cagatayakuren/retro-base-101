import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import PackDetailModal from "./PackDetailModal";
import Retro1155Abi from "../abis/Retro1155Abi.json";
import "./Marketplace.css";

// Contract address
const RETRO1155_CONTRACT_ADDRESS = "0xa95495b0f2e5969a19126a57e740338210dd6a36";

// Base Mainnet RPC
const BASE_RPC_URL = "https://base-rpc.publicnode.com";

// Import melis_mood_pack images
import melisAvailable from "../assets/melis_mood_pack/available.jpeg";
import melisBreak from "../assets/melis_mood_pack/break.jpeg";
import melisBusy from "../assets/melis_mood_pack/busy.jpeg";
import melisDeepWork from "../assets/melis_mood_pack/deep_work.jpeg";
import melisMeeting from "../assets/melis_mood_pack/meeting.jpeg";

// Mock data for mood packs
const mockMoodPacks = [
  {
    id: 1,
    name: "Retro Office Vibes",
    price: "5.00",
    images: [
      melisAvailable,
      melisBreak,
      melisBusy,
      melisDeepWork,
      melisMeeting,
    ],
    creator: {
      username: "studiomel_s",
      avatar: "",
      wallet: "0x1234...5678",
    },
    description: "5 minimal expressive office characters",
  },
  {
    id: 2,
    name: "Neon Dreams",
    price: "0.0015",
    image:
      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&h=400&fit=crop",
    creator: {
      username: "neonartist",
      avatar: "https://i.pravatar.cc/150?img=2",
      wallet: "0xabcd...efgh",
    },
    description: "Glowing neon aesthetics for your display",
  },
  {
    id: 3,
    name: "Pixel Paradise Bundle",
    price: "0.002",
    images: [
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1614732484003-ef9881555dc3?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1642228971269-68098c76cb87?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=400&h=400&fit=crop",
    ],
    creator: {
      wallet: "0x9876...5432",
    },
    description: "Pixel art collection with 5 classic game vibes",
  },
  {
    id: 4,
    name: "Synthwave Sunset",
    price: "0.0025",
    image:
      "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=400&h=400&fit=crop",
    creator: {
      username: "synthwavelover",
      avatar: "https://i.pravatar.cc/150?img=3",
      wallet: "0x5555...6666",
    },
    description: "Retro futuristic synthwave aesthetics",
  },
  {
    id: 5,
    name: "Cyber Punk Mega Pack",
    price: "0.003",
    images: [
      "https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=400&h=400&fit=crop",
    ],
    creator: {
      username: "cyberpunkfan",
      avatar: "https://i.pravatar.cc/150?img=4",
      wallet: "0x7777...8888",
    },
    description: "Dark futuristic cyberpunk mood - 5 image collection",
  },
  {
    id: 6,
    name: "Pastel Dreams",
    price: "0.0012",
    image:
      "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&h=400&fit=crop",
    creator: {
      wallet: "0x3333...4444",
    },
    description: "Soft pastel colors for a calming vibe",
  },
];

function Marketplace({ walletAddress, onPurchase }) {
  const [moodPacks, setMoodPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState(null);
  const [errorPackId, setErrorPackId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPack, setSelectedPack] = useState(null);

  useEffect(() => {
    const loadMoodPacks = async () => {
      setLoading(true);
      try {
        // Create provider for Base network
        const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

        // Create contract instance
        const contract = new ethers.Contract(
          RETRO1155_CONTRACT_ADDRESS,
          Retro1155Abi,
          provider
        );

        // Get total series count
        const totalSeries = await contract.totalSeries();
        const totalSeriesNumber = Number(totalSeries);

        if (totalSeriesNumber === 0) {
          setMoodPacks([]);
          setLoading(false);
          return;
        }

        // Fetch all series info from contract and metadata from baseUri
        const packsPromises = [];
        for (let i = 1; i < totalSeriesNumber + 1; i++) {
          packsPromises.push(
            contract
              .getSeriesInfo(i)
              .then(async (seriesInfo) => {
                try {
                  const tokenId = i;
                  const creator = seriesInfo[0];
                  const maxSupply = seriesInfo[1].toString();
                  const mintedSupply = seriesInfo[2].toString();
                  const mintPrice = seriesInfo[3].toString();
                  const baseUri = seriesInfo[4];

                  // Fetch metadata from baseUri if it's a JSON URL
                  let name = `Series #${tokenId}`;
                  let description = "NFT Series Collection";
                  let images = [];

                  if (baseUri && baseUri.trim() !== "") {
                    try {
                      // If baseUri is a JSON metadata URL, fetch it
                      if (baseUri.startsWith("http")) {
                        const metadataResponse = await fetch(baseUri);
                        if (metadataResponse.ok) {
                          const metadata = await metadataResponse.json();
                          name = metadata.name || name;
                          description = metadata.description || description;
                          
                          // Get images from metadata
                          if (metadata.image) {
                            // Convert ipfs:// to gateway URL if needed
                            const imageUrl = metadata.image.startsWith('ipfs://')
                              ? metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/')
                              : metadata.image;
                            images = [imageUrl];
                          }
                          if (metadata.properties?.images && Array.isArray(metadata.properties.images)) {
                            images = metadata.properties.images.map(img => 
                              img.startsWith('ipfs://')
                                ? img.replace('ipfs://', 'https://ipfs.io/ipfs/')
                                : img
                            );
                          }
                        } else {
                          // If not JSON or fetch fails, use baseUri as image
                          images = [baseUri];
                        }
                      } else if (baseUri.startsWith("ipfs://")) {
                        // IPFS protocol URL
                        images = [baseUri.replace('ipfs://', 'https://ipfs.io/ipfs/')];
                      } else {
                        images = [baseUri];
                      }
                    } catch (err) {
                      console.warn(`Failed to fetch metadata for tokenId ${tokenId}:`, err);
                      // Fallback: use baseUri as image
                      images = baseUri.startsWith("ipfs://")
                        ? [baseUri.replace('ipfs://', 'https://ipfs.io/ipfs/')]
                        : [baseUri];
                    }
                  }

                  // Convert mintPrice from wei (6 decimals for USDC) to USDC
                  const priceInUSDC = ethers.formatUnits(mintPrice, 6);

                  return {
                    id: tokenId,
                    tokenId: tokenId,
                    name: name,
                    description: description,
                    price: priceInUSDC,
                    images: images,
                    image: images[0] || null,
                    creator: {
                      wallet: creator,
                      username: null,
                      avatar: null,
                    },
                    maxSupply: maxSupply,
                    mintedSupply: mintedSupply,
                    baseUri: baseUri,
                    contractAddress: RETRO1155_CONTRACT_ADDRESS,
                  };
                } catch (innerError) {
                  console.error(`Error processing series ${i}:`, innerError);
                  return null;
                }
              })
              .catch((error) => {
                // Log the error but don't filter it out - show it anyway
                console.error(`Error fetching series ${i}:`, error);
                // Return a placeholder pack so we can see which one failed
                return {
                  id: i,
                  tokenId: i,
                  name: `Series #${i} (Error)`,
                  description: `Failed to load: ${error.message}`,
                  price: "0",
                  images: [],
                  image: null,
                  creator: {
                    wallet: "0x0000...0000",
                    username: null,
                    avatar: null,
                  },
                  maxSupply: "0",
                  mintedSupply: "0",
                  baseUri: "",
                  contractAddress: RETRO1155_CONTRACT_ADDRESS,
                  error: true,
                };
              })
          );
        }

        const allPacks = await Promise.all(packsPromises);
        // Filter out only null values, keep error packs for debugging
        const contractPacks = allPacks.filter((pack) => pack !== null);
        
        // Sort by tokenId ascending
        contractPacks.sort((a, b) => a.tokenId - b.tokenId);
        
        // Merge contract packs with mock data
        const mergedPacks = [...contractPacks, ...mockMoodPacks];
        
        console.log(`Loaded ${contractPacks.length} packs from contract and ${mockMoodPacks.length} mock packs (total: ${mergedPacks.length})`);

        setMoodPacks(mergedPacks);
      } catch (err) {
        console.error("Failed to load mood packs:", err);
        // Fallback to mock data on error
        setMoodPacks(mockMoodPacks);
      } finally {
        setLoading(false);
      }
    };

    loadMoodPacks();
  }, []);

  const handlePurchase = async (pack) => {
    if (!walletAddress) {
      setErrorPackId(pack.id);
      setTimeout(() => setErrorPackId(null), 3000);
      return;
    }

    setErrorPackId(null);
    setPurchasingId(pack.id);

    try {
      // TODO: Implement actual purchase logic with contract
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (onPurchase) {
        onPurchase(pack);
      }
    } catch (err) {
      alert(`Failed to purchase: ${err.message}`);
    } finally {
      setPurchasingId(null);
    }
  };

  // Filter packs based on search query
  const filteredPacks = moodPacks.filter((pack) =>
    pack.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="marketplace-container">
        <h1 className="page-title">Marketplace</h1>
        <div className="marketplace-loading">
          <div className="loading-spinner"></div>
          <p>Loading mood packs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      <h1 className="page-title">Marketplace</h1>

      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search mood packs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery("")}>
            ×
          </button>
        )}
      </div>

      <div className="marketplace-grid">
        {filteredPacks.map((pack) => {
          const hasMultipleImages = pack.images && pack.images.length > 1;

          return (
            <div key={pack.id} className="mood-pack-card">
              <div
                className="pack-image-container"
                onClick={() => setSelectedPack(pack)}
                style={{ cursor: "pointer" }}
              >
                {hasMultipleImages ? (
                  <div
                    className={`multi-image-grid ${
                      pack.images.length >= 5 ? "show-all-5" : ""
                    }`}
                  >
                    {pack.images.slice(0, 5).map((img, idx) => (
                      <div
                        key={idx}
                        className={`grid-image grid-image-${idx + 1}`}
                      >
                        <img src={img} alt={`${pack.name} ${idx + 1}`} />
                      </div>
                    ))}
                    {pack.images.length > 5 && (
                      <div className="more-images-badge">
                        +{pack.images.length - 5}
                      </div>
                    )}
                  </div>
                ) : (
                  <img
                    src={pack.image || pack.images[0]}
                    alt={pack.name}
                    className="pack-image"
                  />
                )}
                <div className="pack-overlay">
                  <button
                    className={`buy-button ${
                      purchasingId === pack.id ? "purchasing" : ""
                    }`}
                    onClick={() => handlePurchase(pack)}
                    disabled={purchasingId === pack.id}
                  >
                    {purchasingId === pack.id ? "Purchasing..." : `Buy`}
                  </button>
                </div>
              </div>

              <div className="pack-info">
                <h3 className="pack-name">{pack.name}</h3>
                <p className="pack-description">{pack.description}</p>

                <div className="pack-footer">
                  <div className="creator-info">
                    {pack.creator.avatar ? (
                      <img
                        src={pack.creator.avatar}
                        alt={pack.creator.username || "Creator"}
                        className="creator-avatar-small"
                      />
                    ) : (
                      <div className="creator-avatar-small placeholder">
                        {pack.creator.wallet.slice(2, 3).toUpperCase()}
                      </div>
                    )}
                    <div className="creator-text">
                      <span className="creator-by">CREATED BY</span>
                      <span className="creator-name-small">
                        {pack.creator.username ||
                          `${pack.creator.wallet.slice(
                            0,
                            6
                          )}...${pack.creator.wallet.slice(-4)}`}
                      </span>
                    </div>
                  </div>

                  <div className="pack-price">
                    <span className="price-label">PRICE</span>
                    <span className="price-amount">{pack.price} USDC</span>
                  </div>
                </div>

                {errorPackId === pack.id && (
                  <div className="wallet-warning">
                    Please connect your wallet to purchase
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredPacks.length === 0 && moodPacks.length > 0 && (
        <div className="no-packs">
          <div className="no-packs-icon">🔍</div>
          <h3>No Packs Found</h3>
          <p>Try a different search term</p>
        </div>
      )}

      {moodPacks.length === 0 && (
        <div className="no-packs">
          <div className="no-packs-icon">🎨</div>
          <h3>No Mood Packs Available</h3>
          <p>Check back later for new mood packs!</p>
        </div>
      )}

      {/* Pack Detail Modal */}
      {selectedPack && (
        <PackDetailModal
          pack={selectedPack}
          onClose={() => setSelectedPack(null)}
          onPurchase={handlePurchase}
          walletAddress={walletAddress}
          isPurchasing={purchasingId === selectedPack.id}
        />
      )}
    </div>
  );
}

export default Marketplace;
