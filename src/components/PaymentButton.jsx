import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { sdk } from '@farcaster/miniapp-sdk'
import { addPayment, getUserData } from '../services/firebaseService'
import './PaymentButton.css'

// Ödeme alınacak adres - Environment variable'dan al veya default kullan
const PAYMENT_ADDRESS = import.meta.env.VITE_PAYMENT_ADDRESS || '0x0000000000000000000000000000000000000000'

function PaymentButton({ walletAddress, onPaymentSuccess }) {
  const [amount, setAmount] = useState('1.00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handlePayment = async () => {
    // Coming soon
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
    return;

    if (!walletAddress) {
      setError('Please connect your wallet first')
      return
    }

    // Base wallet kontrolü
    let provider = null
    if (window.base && window.base.ethereum) {
      provider = window.base.ethereum
    } else if (window.ethereum) {
      // Base network'te olduğundan emin ol
      const BASE_CHAIN_ID = '0x2105'
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (currentChainId !== BASE_CHAIN_ID) {
        setError('Please switch to Base network in your Base wallet')
        return
      }
      provider = window.ethereum
    } else {
      setError('Base wallet not found. Please use Base App or install Base wallet.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Ödeme işlemi
      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()
      
      const tx = await signer.sendTransaction({
        to: PAYMENT_ADDRESS,
        value: ethers.parseEther(amount),
      })

      // Transaction'ı bekle
      const receipt = await tx.wait()

      // Firebase'e kaydet
      try {
        await addPayment(walletAddress, amount, tx.hash)
      } catch (firebaseError) {
        console.error('Firebase save error:', firebaseError)
        console.error('Firebase error code:', firebaseError.code)
        console.error('Firebase error message:', firebaseError.message)
        
        // Transaction başarılı ama Firebase'e kaydedilemedi
        const errorMsg = firebaseError.message || 'Failed to save payment'
        setError(`Payment successful but failed to save: ${errorMsg}. Transaction hash: ${tx.hash}`)
        
        // Yine de success göster ama hata mesajı da göster
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          setError(null)
        }, 5000)
        return
      }
      
      setSuccess(true)
      if (onPaymentSuccess) {
        onPaymentSuccess(amount)
      }
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Payment error:', err)
      if (err.code === 4001) {
        setError('Transaction rejected by user')
      } else if (err.code === 'INSUFFICIENT_FUNDS' || err.message?.includes('insufficient funds')) {
        setError('Insufficient funds')
      } else {
        setError(err.message || 'Payment failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const [userData, setUserData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)

  // Kullanıcı verilerini yükle
  useEffect(() => {
    const loadUserData = async () => {
      if (walletAddress) {
        setLoadingData(true)
        try {
          const data = await getUserData(walletAddress)
          setUserData(data)
        } catch (error) {
          console.error('Error loading user data:', error)
        } finally {
          setLoadingData(false)
        }
      } else {
        setUserData(null)
      }
    }
    loadUserData()
  }, [walletAddress])

  const totalPaid = userData ? parseFloat(userData.totalPaid || 0) : 0

  return (
    <div className="payment-container">
      <div className="payment-info">
        <div className="total-paid">
          <span className="label">Total Paid:</span>
          <span className="amount">{totalPaid.toFixed(2)} USDC</span>
        </div>
      </div>

      <div className="payment-input-group">
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="payment-input"
          placeholder="1.00"
          disabled={loading}
        />
        <span className="eth-label">USDC</span>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading || parseFloat(amount) <= 0}
        className="payment-button"
      >
        {loading ? 'Coming Soon 🚀' : success ? 'Payment Successful!' : 'Pay to Rank Up'}
      </button>

      {error && <div className="payment-error">{error}</div>}
      
      <div className="payment-note">
        <small>Pay USDC to move up in the leaderboard. Higher payments = higher rank!</small>
      </div>
    </div>
  )
}

export default PaymentButton

