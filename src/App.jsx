import React, { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import RetroDevice from "./components/RetroDevice";
import Leaderboard from "./components/Leaderboard";
import Creator from "./components/Creator";
import Marketplace from "./components/Marketplace";
import NFTConnector from "./components/NFTConnector";
import PaymentButton from "./components/PaymentButton";
import VibeCoding from "./components/VibeCoding";
import {
  saveUserData,
  getUserData,
  updateUserDisplay,
} from "./services/firebaseService";
import "./App.css";

function App() {
  const [currentPage, setCurrentPage] = useState("marketplace"); // 'home', 'leaderboard', 'creator', 'marketplace'
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [ledHue, setLedHue] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userProfile, setUserProfile] = useState(null); // { username, avatar, custodyAddress }
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Dinamik page-title font-size ayarlama (responsive)
  useEffect(() => {
    const adjustTitleFontSize = () => {
      const titleElement = document.querySelector(".page-title");
      if (!titleElement) return;

      // CSS'den gelen font-size'ı al
      const computedStyle = window.getComputedStyle(titleElement);
      const originalFontSize = parseFloat(computedStyle.fontSize);

      // Önce original CSS font-size'ına dön
      titleElement.style.fontSize = "";

      // Timeout ile DOM'un güncellenmesini bekle
      requestAnimationFrame(() => {
        const containerWidth =
          titleElement.parentElement?.offsetWidth || titleElement.offsetWidth;
        const availableWidth = containerWidth - 160; // Hamburger menü için boşluk

        // Geçici bir div oluştur ve metnin gerçek genişliğini ölç
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.visibility = "hidden";
        tempDiv.style.whiteSpace = "nowrap";
        tempDiv.style.fontSize = computedStyle.fontSize;
        tempDiv.style.fontWeight = computedStyle.fontWeight;
        tempDiv.style.letterSpacing = computedStyle.letterSpacing;
        tempDiv.style.fontFamily = computedStyle.fontFamily;
        tempDiv.textContent = titleElement.textContent;
        document.body.appendChild(tempDiv);

        const textWidth = tempDiv.offsetWidth;
        document.body.removeChild(tempDiv);

        // Eğer metin taşıyorsa, font-size'ı küçült
        if (textWidth > availableWidth) {
          const ratio = availableWidth / textWidth;
          const newSize = Math.max(12, originalFontSize * ratio * 0.92); // %92 oranla küçült, min 12px
          titleElement.style.fontSize = `${newSize}px`;
          titleElement.style.whiteSpace = "normal"; // Alt satıra geçebilsin
        } else {
          // Sığıyorsa CSS'deki font-size'ı kullan
          titleElement.style.fontSize = "";
          titleElement.style.whiteSpace = "nowrap";
        }
      });
    };

    // İlk yükleme
    const timeoutId = setTimeout(adjustTitleFontSize, 50);

    // Resize observer ile sürekli izle
    const resizeObserver = new ResizeObserver(adjustTitleFontSize);
    const titleElement = document.querySelector(".page-title");
    if (titleElement) {
      resizeObserver.observe(titleElement);
    }

    // Window resize için de listener ekle
    window.addEventListener("resize", adjustTitleFontSize);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", adjustTitleFontSize);
    };
  }, [currentPage]);

  // Base Mini App SDK - ready() çağrısı ve kullanıcı bilgilerini al
  useEffect(() => {
    const initSDK = async () => {
      try {
        await sdk.actions.ready();

        // Kullanıcı bilgilerini al
        try {
          const context = await sdk.context;
          if (context && context.user) {
            // Profil fotoğrafı için tüm olası alanları dene
            let avatarUrl = null;

            // Farcaster pfpUrl kullanımı (Base Mini App)
            if (context.user.pfpUrl) {
              avatarUrl = context.user.pfpUrl;
            } else if (context.user.pfp?.url) {
              avatarUrl = context.user.pfp.url;
            } else if (context.user.pfp) {
              avatarUrl = context.user.pfp;
            } else if (context.user.avatar) {
              avatarUrl = context.user.avatar;
            } else if (context.user.avatarUrl) {
              avatarUrl = context.user.avatarUrl;
            } else if (context.user.profileImage) {
              avatarUrl = context.user.profileImage;
            } else if (context.user.profileImageUrl) {
              avatarUrl = context.user.profileImageUrl;
            }

            setUserProfile({
              username:
                context.user.username || context.user.displayName || "User",
              avatar: avatarUrl,
              custodyAddress: context.user.custodyAddress,
            });
            // Wallet address'i de set et
            if (context.user.custodyAddress) {
              setWalletAddress(context.user.custodyAddress);
            }
          } else {
            // SDK'dan veri gelmezse boş profil kullan
            setUserProfile({
              username: "",
              avatar: "",
              custodyAddress: null,
            });
          }
        } catch (contextError) {
          // SDK hatası durumunda boş profil kullan
          setUserProfile({
            username: "",
            avatar: "",
            custodyAddress: null,
          });
        }
      } catch (error) {
        console.error("Failed to initialize Mini App SDK:", error);
        // SDK başlatılamadıysa boş profil kullan
        setUserProfile({
          username: "",
          avatar: "",
          custodyAddress: null,
        });
      }
    };
    initSDK();
  }, []);

  // Kullanıcı verilerini yükle
  useEffect(() => {
    const loadUserData = async () => {
      if (walletAddress) {
        try {
          const userData = await getUserData(walletAddress);
          if (userData) {
            // NFT verilerini yükle - hem URL hem de contract/tokenId
            if (userData.nftImage) {
              setSelectedNFT({
                imageUrl: userData.nftImage,
                contract: userData.nftContract || null,
                tokenId: userData.nftTokenId || null,
              });
            }
            if (userData.ledHue !== undefined) setLedHue(userData.ledHue);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      }
    };
    loadUserData();
  }, [walletAddress]);

  // NFT veya LED rengi değiştiğinde kaydet
  const handleSaveUserData = async (nftData, hue) => {
    if (walletAddress) {
      try {
        const updateData = {
          ledHue: hue !== undefined ? hue : ledHue,
        };

        // NFT data varsa kaydet (imageUrl, contract, tokenId)
        if (nftData) {
          updateData.nftImage = nftData.imageUrl || nftData;
          updateData.nftContract = nftData.contract || null;
          updateData.nftTokenId = nftData.tokenId || null;
        } else if (selectedNFT) {
          // Eğer nftData yoksa ama selectedNFT varsa onu kullan
          updateData.nftImage = selectedNFT.imageUrl || selectedNFT;
          updateData.nftContract = selectedNFT.contract || null;
          updateData.nftTokenId = selectedNFT.tokenId || null;
        }

        await updateUserDisplay(walletAddress, updateData);
      } catch (error) {
        console.error("Error saving user data:", error);
      }
    }
  };

  const handlePaymentSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Sekme değiştiğinde payment alanını kapat (selectedNFT'yi sıfırla)
  const handlePageChange = (page) => {
    setCurrentPage(page);
    setIsDrawerOpen(false);

    // Eğer home sayfasından çıkıyorsak payment alanını kapat
    if (currentPage === "home" && page !== "home") {
      setSelectedNFT(null);
    }

    // Sayfanın en üstüne scroll et
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="App">
      {/* Hamburger Menu Button */}
      <button
        className="hamburger-menu"
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Drawer Navigation */}
      <div className={`drawer ${isDrawerOpen ? "open" : ""}`}>
        <div
          className="drawer-overlay"
          onClick={() => setIsDrawerOpen(false)}
        ></div>
        <div className="drawer-content">
          <button
            className="drawer-close"
            onClick={() => setIsDrawerOpen(false)}
          >
            ×
          </button>
          <div className="drawer-menu">
            <button
              onClick={() => handlePageChange("marketplace")}
              className={currentPage === "marketplace" ? "active" : ""}
            >
              Marketplace
            </button>
            <button
              onClick={() => handlePageChange("home")}
              className={currentPage === "home" ? "active" : ""}
            >
              Customize
            </button>
            <button
              onClick={() => handlePageChange("creator")}
              className={currentPage === "creator" ? "active" : ""}
            >
              Creator
            </button>
            <button
              onClick={() => handlePageChange("leaderboard")}
              className={currentPage === "leaderboard" ? "active" : ""}
            >
              Leaderboard
            </button>
            <button
              onClick={() => handlePageChange("vibecoding")}
              className={currentPage === "vibecoding" ? "active" : ""}
            >
              Vibe Coding
            </button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      {currentPage === "home" && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h1 className="page-title">My NFT Displayer</h1>
          <RetroDevice
            nftImage={selectedNFT?.imageUrl || selectedNFT}
            ledHue={ledHue}
            onLedHueChange={(hue) => {
              setLedHue(hue);
              handleSaveUserData(selectedNFT, hue);
            }}
            userProfile={userProfile}
            nftConnector={
              <NFTConnector
                onNFTSelect={(nftData) => {
                  setSelectedNFT(nftData);
                  handleSaveUserData(nftData, ledHue);
                }}
                onWalletConnect={setWalletAddress}
                walletAddress={walletAddress}
              />
            }
            paymentButton={
              walletAddress && selectedNFT ? (
                <PaymentButton
                  walletAddress={walletAddress}
                  onPaymentSuccess={handlePaymentSuccess}
                />
              ) : null
            }
          />
        </div>
      )}

      {currentPage === "marketplace" && (
        <Marketplace
          walletAddress={walletAddress}
          onPurchase={(pack) => {
            handlePaymentSuccess();
          }}
        />
      )}

      {currentPage === "creator" && (
        <Creator walletAddress={walletAddress} userProfile={userProfile} />
      )}

      {currentPage === "leaderboard" && <Leaderboard key={refreshKey} />}

      {currentPage === "vibecoding" && <VibeCoding />}
    </div>
  );
}

export default App;
