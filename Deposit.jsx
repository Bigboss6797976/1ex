import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import QRCode from 'qrcode.react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { motion } from 'framer-motion';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const Deposit = () => {
  const [activeTab, setActiveTab] = useState('card');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 获取用户信息
    axios.get('/api/user/profile')
      .then(res => setUser(res.data.user))
      .catch(err => console.error('Failed to fetch user:', err));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Deposit Funds</h1>
          <p className="text-gray-400">Current Balance: <span className="text-yellow-400 font-bold">${user?.balance.toFixed(2) || '0.00'}</span></p>
        </motion.div>

        {/* 快速选择金额 */}
        <div className="mb-8">
          <p className="text-gray-300 mb-4">Quick Select Amount:</p>
          <div className="grid grid-cols-4 gap-3">
            {[10, 50, 100, 500, 1000, 5000].map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                className={`py-3 px-4 rounded-lg font-bold transition ${
                  amount === amt.toString()
                    ? 'bg-yellow-500 text-black'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* 支付方式选择 */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <div className="flex gap-4 mb-6 border-b border-gray-700 overflow-x-auto">
            {[
              { id: 'usdt', label: '₿ USDT (TRC20)', icon: '₿' },
              { id: 'alipay', label: '🇨🇳 Alipay', icon: '🇨🇳' },
              { id: 'wechat', label: '🇨🇳 WeChat Pay', icon: '💬' },
              { id: 'aba', label: '🇰🇭 ABA Pay', icon: '🏦' },
              { id: 'cash', label: '💵 Bank Transfer', icon: '💵' }
            ].map(method => (
              <button
                key={method.id}
                onClick={() => setActiveTab(method.id)}
                className={`py-4 px-4 font-bold transition border-b-2 whitespace-nowrap ${
                  activeTab === method.id
                    ? 'border-yellow-500 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
              <button
                key={method.id}
                onClick={() => setActiveTab(method.id)}
                className={`py-4 px-4 font-bold transition border-b-2 ${
                  activeTab === method.id
                    ? 'border-yellow-500 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>

          {/* Card Payment */}
          {activeTab === 'card' && (
            <CardPaymentForm amount={amount} setAmount={setAmount} />
          )}

          {/* USDT Payment */}
          {activeTab === 'usdt' && (
            <USDTPaymentForm amount={amount} />
          )}

          {/* Bank Transfer */}
          {activeTab === 'bank' && (
            <BankTransferForm amount={amount} />
          )}

          {/* E-Wallet */}
          {activeTab === 'ewallet' && (
            <EWalletPaymentForm amount={amount} />
          )}
          
          {/* 现金充值 */}
          {activeTab === 'cash' && (
            <CashDepositForm amount={amount} />
          )}
        </div>

        {/* 信息提示 */}
        <div className="bg-blue-900 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-blue-200">
            ✓ All deposits are processed securely with industry-standard encryption.
            <br/>
            ✓ Minimum deposit: $10 | Maximum deposit: $50,000 per day
          </p>
        </div>
      </div>
    </div>
  );
};

// ============ Card Payment Component ============

function CardPaymentForm({ amount, setAmount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;
    if (!amount || amount < 10) {
      toast.error('Minimum deposit: $10');
      return;
    }

    setLoading(true);

    try {
      // 创建支付意图
      const { data } = await axios.post('/api/payment/stripe/create-intent', {
        amount: parseFloat(amount),
        currency: 'usd'
      });

      // 确认支付
      const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {}
        }
      });

      if (error) {
        toast.error(error.message);
      } else if (paymentIntent.status === 'succeeded') {
        toast.success(`Deposit of $${amount} successful!`);
        setAmount('');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePayment}>
      <div className="mb-6">
        <label className="block text-white mb-2">Amount (USD)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          min="10"
          max="50000"
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <div className="mb-6">
        <label className="block text-white mb-2">Card Details</label>
        <div className="bg-gray-700 p-4 rounded-lg">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#ffffff',
                  '::placeholder': { color: '#9ca3af' }
                }
              }
            }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
      >
        {loading ? 'Processing...' : 'Deposit Now'}
      </button>
    </form>
  );
}

// ============ USDT Payment Component ============

function USDTPaymentForm({ amount }) {
  const [address, setAddress] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateAddress();
  }, []);

  const generateAddress = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post('/api/payment/usdt/generate-address');
      setAddress(data.address);
      setQrCode(data.qrCode);
    } catch (error) {
      toast.error('Failed to generate address');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="text-center">
      <div className="mb-6">
        <p className="text-gray-400 mb-4">Send USDT (TRC20) to the address below:</p>
        
        <div className="bg-gray-700 p-6 rounded-lg mb-4">
          <img src={qrCode} alt="QR Code" className="mx-auto w-48 h-48" />
        </div>

        <div className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
          <code className="text-yellow-400 text-sm break-all">{address}</code>
          <button
            onClick={copyAddress}
            className="ml-2 text-gray-400 hover:text-white"
          >
            {copied ? <FiCheck /> : <FiCopy />}
          </button>
        </div>
      </div>

      <div className="bg-green-900 border-l-4 border-green-500 p-4 rounded">
        <p className="text-green-200 text-sm">
          ⏱️ Your deposit will be confirmed within 5-10 minutes after transaction is confirmed on blockchain.
        </p>
      </div>

      <button
        onClick={generateAddress}
        disabled={loading}
        className="mt-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition"
      >
        Generate New Address
      </button>
    </div>
  );
}

// ============ Bank Transfer Component ============

function BankTransferForm({ amount }) {
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await axios.post('/api/payment/bank/wire-transfer', {
        amount: parseFloat(amount),
        bankDetails
      });
      
      toast.success('Wire transfer request submitted. You will receive further instructions.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <input
          type="number"
          value={amount}
          placeholder="Amount (USD)"
          min="100"
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          disabled
        />
        
        <input
          type="text"
          placeholder="Bank Name"
          value={bankDetails.bankName}
          onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})}
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          required
        />

        <input
          type="text"
          placeholder="Account Holder Name"
          value={bankDetails.accountHolder}
          onChange={(e) => setBankDetails({...bankDetails, accountHolder: e.target.value})}
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          required
        />

        <input
          type="text"
          placeholder="Account Number"
          value={bankDetails.accountNumber}
          onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          required
        />

        <input
          type="text"
          placeholder="Routing Number (US) / IBAN"
          value={bankDetails.routingNumber}
          onChange={(e) => setBankDetails({...bankDetails, routingNumber: e.target.value})}
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          required
        />

        <input
          type="text"
          placeholder="SWIFT Code"
          value={bankDetails.swiftCode}
          onChange={(e) => setBankDetails({...bankDetails, swiftCode: e.target.value})}
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-6 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
      >
        {loading ? 'Processing...' : 'Request Bank Transfer'}
      </button>
    </form>
  );
}

// ============ E-Wallet Payment Component ============

function EWalletPaymentForm({ amount }) {
  const [selectedProvider, setSelectedProvider] = useState('alipay');
  const [loading, setLoading] = useState(false);

  const providers = [
    { 
      id: 'alipay', 
      label: '支付宝 Alipay', 
      icon: '🇨🇳',
      description: 'Fast payment via Alipay',
      minAmount: 1,
      maxAmount: 50000
    },
    { 
      id: 'wechat', 
      label: '微信支付 WeChat Pay', 
      icon: '💬',
      description: 'Pay via WeChat',
      minAmount: 1,
      maxAmount: 50000
    },
    { 
      id: 'aba_pay', 
      label: 'ABA Pay (Cambodia)', 
      icon: '🇰🇭',
      description: 'ABA Bank Mobile Payment',
      minAmount: 5,
      maxAmount: 10000
    }
  ];

  const handlePayment = async () => {
    if (!amount || amount < 10) {
      toast.error('Minimum deposit: $10');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`/api/payment/ewallet/${selectedProvider}`, {
        amount: parseFloat(amount)
      });

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        toast.success('Payment initiated. Redirecting...');
        setTimeout(() => window.location.href = data.paymentUrl, 2000);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-white mb-4 font-bold">Select Payment Method:</label>
        <div className="grid grid-cols-1 gap-3">
          {providers.map(provider => (
            <button
              key={provider.id}
              onClick={() => setSelectedProvider(provider.id)}
              className={`p-4 rounded-lg text-left transition border-2 ${
                selectedProvider === provider.id
                  ? 'border-yellow-500 bg-yellow-500 bg-opacity-10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{provider.icon} {provider.label}</p>
                  <p className="text-gray-400 text-sm">{provider.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedProvider === provider.id 
                    ? 'border-yellow-500 bg-yellow-500' 
                    : 'border-gray-500'
                }`}>
                  {selectedProvider === provider.id && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-blue-900 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-blue-200 text-sm">
          {selectedProvider === 'alipay' && '✓ Alipay will open in a new window. Please complete payment and return to confirm.'}
          {selectedProvider === 'wechat' && '✓ Scan the QR code with WeChat app to complete payment.'}
          {selectedProvider === 'aba_pay' && '✓ You will be redirected to ABA Bank to complete payment.'}
        </p>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading || !amount || amount < 10}
        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
      >
        {loading ? 'Processing...' : `Pay $${amount || '0'} with ${selectedProvider.toUpperCase()}`}
      </button>
    </div>
  );
}

// ============ Cash Deposit Component ============

function CashDepositForm({ amount }) {
  const [loading, setLoading] = useState(false);
  const [bankInfo, setBankInfo] = useState(null);

  const handleCashDeposit = async () => {
    if (!amount || amount < 50) {
      toast.error('Minimum cash deposit: $50');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/api/payment/cash/deposit', {
        amount: parseFloat(amount)
      });

      setBankInfo(data.bankDetails);
      toast.success('Bank transfer details shown below');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create deposit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-white mb-2 font-bold">Amount (USD)</label>
        <input
          type="number"
          value={amount}
          placeholder="Minimum: $50"
          min="50"
          max="100000"
          disabled
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {bankInfo && (
        <div className="bg-gray-700 p-6 rounded-lg space-y-4">
          <h3 className="text-white font-bold mb-4">Bank Transfer Details:</h3>
          <div className="space-y-3">
            <div>
              <p className="text-gray-400 text-sm">Bank Name</p>
              <p className="text-white font-bold">{bankInfo.bankName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Account Holder</p>
              <p className="text-white font-bold">{bankInfo.accountName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Account Number</p>
              <div className="flex items-center gap-2">
                <p className="text-white font-bold font-mono">{bankInfo.accountNumber}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(bankInfo.accountNumber);
                    toast.success('Copied!');
                  }}
                  className="text-yellow-400 hover:text-yellow-300"
                >
                  📋
                </button>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Routing Number</p>
              <p className="text-white font-bold font-mono">{bankInfo.routingNumber}</p>
            </div>
          </div>

          <div className="bg-green-900 border-l-4 border-green-500 p-4 rounded mt-4">
            <p className="text-green-200 text-sm">
              ✓ Please transfer ${amount || '0'} USD to the account above.<br/>
              ✓ Your deposit will be confirmed within 24 hours.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleCashDeposit}
        disabled={loading || !amount || amount < 50}
        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
      >
        {loading ? 'Processing...' : 'Get Bank Details'}
      </button>
    </div>
  );
}

export default () => (
  <Elements stripe={stripePromise}>
    <Deposit />
  </Elements>
);
