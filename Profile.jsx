import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FiUser, FiMail, FiPhone, FiLock, FiEdit2, FiSave,
  FiLogOut, FiCopy, FiCheck, FiShield, FiGlobe,
  FiDollarSign, FiClock, FiBell, FiEye, FiEyeOff
} from 'react-icons/fi';

/* ───────────────────────────────── helpers ─────────────────────────────── */
const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zh', label: '汉语',    flag: '🇨🇳' },
  { code: 'km', label: 'ភាសាខ្មែរ', flag: '🇰🇭' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
];

const CURRENCIES = ['USD','USDT','EUR','CNY'];

const vipColors  = ['#6b7280','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981'];
const vipLabels  = ['Standard','Bronze','Silver','Gold','Platinum','Diamond'];

/* ───────────────────────────────── sub-components ──────────────────────── */

function StatCard({ label, value, sub, color = '#f59e0b' }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="text-yellow-400" size={18} />
      <h2 className="text-white font-bold text-lg">{title}</h2>
    </div>
  );
}

/* ───────────────────────────────── main page ────────────────────────────── */
export default function Profile() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('info'); // info | security | settings | activity
  const [editMode,setEditMode]= useState(false);
  const [copied,  setCopied]  = useState(false);
  const [showPwd, setShowPwd] = useState({ cur:false, new:false, con:false });

  const [form, setForm] = useState({
    username:'', phone:'', language:'en', currency:'USD',
    emailNotifications: true, smsNotifications: false,
  });
  const [pwdForm, setPwdForm] = useState({ currentPassword:'', newPassword:'', confirm:'' });

  /* fetch user */
  useEffect(() => {
    API.get('/user/profile')
      .then(r => {
        setUser(r.data.user);
        const u = r.data.user;
        setForm({
          username: u.username || '',
          phone:    u.phone    || '',
          language: u.preferences?.language || 'en',
          currency: u.preferences?.currency || 'USD',
          emailNotifications: u.preferences?.emailNotifications ?? true,
          smsNotifications:   u.preferences?.smsNotifications   ?? false,
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  /* save profile */
  const saveProfile = async () => {
    try {
      const { data } = await API.put('/user/profile', form);
      setUser(data.user);
      setEditMode(false);
      toast.success('Profile updated!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Update failed');
    }
  };

  /* change password */
  const changePassword = async () => {
    if (pwdForm.newPassword !== pwdForm.confirm) {
      return toast.error('Passwords do not match');
    }
    try {
      await API.post('/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword:     pwdForm.newPassword,
      });
      toast.success('Password changed!');
      setPwdForm({ currentPassword:'', newPassword:'', confirm:'' });
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to change password');
    }
  };

  /* copy referral code */
  const copyReferral = () => {
    navigator.clipboard.writeText(user?.referral?.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* logout */
  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white gap-4">
      <p className="text-xl">Please log in to view your profile.</p>
      <a href="/login" className="bg-yellow-500 text-black font-bold px-6 py-2 rounded-lg">Login</a>
    </div>
  );

  const vipLevel = user.vip?.level ?? 0;
  const kycBadge = {
    verified:   { label:'Verified',   color:'text-green-400',  bg:'bg-green-900'  },
    pending:    { label:'Pending',     color:'text-yellow-400', bg:'bg-yellow-900' },
    unverified: { label:'Unverified',  color:'text-red-400',    bg:'bg-red-900'    },
    rejected:   { label:'Rejected',    color:'text-red-400',    bg:'bg-red-900'    },
  }[user.kyc?.status] ?? { label:'Unknown', color:'text-gray-400', bg:'bg-gray-700' };

  /* ─ tabs config ─ */
  const tabs = [
    { id:'info',     label:'Personal Info' },
    { id:'security', label:'Security'      },
    { id:'settings', label:'Settings'      },
    { id:'activity', label:'Activity'      },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">

      {/* ── header banner ── */}
      <div className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 px-6 pt-8 pb-24">
        <div className="max-w-3xl mx-auto flex items-center gap-5">
          {/* avatar */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-yellow-400"
            style={{ background: vipColors[vipLevel] }}>
            {user.username?.[0]?.toUpperCase() || 'U'}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">{user.username}</h1>
            <p className="text-blue-300 text-sm">{user.email}</p>

            <div className="flex gap-2 mt-2 flex-wrap">
              {/* VIP badge */}
              <span className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ background: vipColors[vipLevel] + '33', color: vipColors[vipLevel], border: `1px solid ${vipColors[vipLevel]}` }}>
                ⭐ {vipLabels[vipLevel]} VIP
              </span>
              {/* KYC badge */}
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${kycBadge.bg} ${kycBadge.color}`}>
                🛡 KYC {kycBadge.label}
              </span>
            </div>
          </div>

          <button onClick={logout}
            className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm font-bold">
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* ── stats strip ── */}
      <div className="max-w-3xl mx-auto px-4 -mt-16 z-10 relative">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Balance"       value={`$${(user.balance||0).toFixed(2)}`}          color="#f59e0b" />
          <StatCard label="Total Deposited" value={`$${(user.totalDeposited||0).toFixed(0)}`} color="#10b981" />
          <StatCard label="Total Bets"    value={`$${(user.vip?.totalBets||0).toFixed(0)}`}   color="#8b5cf6" />
        </div>
      </div>

      {/* ── tab bar ── */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex bg-gray-800 rounded-xl p-1 mb-6 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition whitespace-nowrap ${
                tab === t.id
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity:0, y:8 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-8 }}
            transition={{ duration:0.15 }}>

            {/* ══════ PERSONAL INFO ══════ */}
            {tab === 'info' && (
              <div className="bg-gray-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={FiUser} title="Personal Info" />
                  <button onClick={() => editMode ? saveProfile() : setEditMode(true)}
                    className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-lg transition ${
                      editMode ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-yellow-400 hover:bg-gray-600'
                    }`}>
                    {editMode ? <><FiSave size={14}/> Save</> : <><FiEdit2 size={14}/> Edit</>}
                  </button>
                </div>

                {/* account id */}
                <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Account ID</p>
                    <p className="text-white font-mono font-bold">#{user._id?.slice(-8).toUpperCase()}</p>
                  </div>
                  <button onClick={copyReferral}
                    className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
                    {copied ? <FiCheck className="text-green-400" /> : <FiCopy />}
                    {copied ? 'Copied' : 'Copy ID'}
                  </button>
                </div>

                {/* username */}
                <Field icon={FiUser} label="Username" edit={editMode}
                  value={form.username}
                  onChange={v => setForm(f => ({...f, username: v}))} />

                {/* email (readonly) */}
                <Field icon={FiMail} label="Email" edit={false}
                  value={user.email} readonlyNote="Contact support to change email" />

                {/* phone */}
                <Field icon={FiPhone} label="Phone Number" edit={editMode}
                  value={form.phone}
                  onChange={v => setForm(f => ({...f, phone: v}))} />

                {/* referral code */}
                <div>
                  <p className="text-gray-400 text-xs mb-1">Referral Code</p>
                  <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-4 py-3">
                    <p className="text-yellow-400 font-mono font-bold flex-1">{user.referral?.code || 'N/A'}</p>
                    <button onClick={copyReferral}
                      className="text-gray-400 hover:text-white">
                      {copied ? <FiCheck className="text-green-400" /> : <FiCopy />}
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Share code to earn 5% referral commission</p>
                </div>

                {/* VIP progress */}
                <div>
                  <p className="text-gray-400 text-xs mb-2">VIP Progress ({vipLabels[vipLevel]})</p>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, ((user.vip?.totalBets||0) / 100000) * 100)}%`,
                        background: vipColors[vipLevel]
                      }} />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    ${(user.vip?.totalBets||0).toFixed(0)} / $100,000 to next level
                  </p>
                </div>
              </div>
            )}

            {/* ══════ SECURITY ══════ */}
            {tab === 'security' && (
              <div className="space-y-4">

                {/* KYC status card */}
                <div className={`rounded-xl p-5 border ${
                  user.kyc?.status === 'verified'
                    ? 'bg-green-900/30 border-green-700'
                    : 'bg-yellow-900/30 border-yellow-700'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FiShield size={20} className={kycBadge.color} />
                      <h3 className="font-bold text-white">KYC Verification</h3>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${kycBadge.bg} ${kycBadge.color}`}>
                      {kycBadge.label}
                    </span>
                  </div>
                  {user.kyc?.status !== 'verified' && (
                    <>
                      <p className="text-gray-300 text-sm mb-3">
                        Complete KYC to unlock withdrawals and higher deposit limits.
                      </p>
                      <a href="/kyc"
                        className="inline-block bg-yellow-500 text-black font-bold px-5 py-2 rounded-lg text-sm">
                        Verify Now →
                      </a>
                    </>
                  )}
                  {user.kyc?.status === 'verified' && (
                    <p className="text-green-300 text-sm">
                      ✓ Your identity has been verified. All features unlocked.
                    </p>
                  )}
                </div>

                {/* change password */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <SectionHeader icon={FiLock} title="Change Password" />
                  <div className="space-y-3">
                    <PwdField label="Current Password"
                      value={pwdForm.currentPassword}
                      show={showPwd.cur}
                      onToggle={() => setShowPwd(s => ({...s, cur:!s.cur}))}
                      onChange={v => setPwdForm(f => ({...f, currentPassword:v}))} />
                    <PwdField label="New Password"
                      value={pwdForm.newPassword}
                      show={showPwd.new}
                      onToggle={() => setShowPwd(s => ({...s, new:!s.new}))}
                      onChange={v => setPwdForm(f => ({...f, newPassword:v}))} />
                    <PwdField label="Confirm New Password"
                      value={pwdForm.confirm}
                      show={showPwd.con}
                      onToggle={() => setShowPwd(s => ({...s, con:!s.con}))}
                      onChange={v => setPwdForm(f => ({...f, confirm:v}))} />
                    <button onClick={changePassword}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg transition mt-2">
                      Update Password
                    </button>
                  </div>
                </div>

                {/* 2FA */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <SectionHeader icon={FiShield} title="Two-Factor Authentication" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-bold">2FA Protection</p>
                      <p className="text-gray-400 text-xs mt-1">
                        {user.security?.twoFAEnabled
                          ? 'Your account is protected with 2FA.'
                          : 'Enable 2FA to add extra security.'}
                      </p>
                    </div>
                    <Toggle
                      enabled={user.security?.twoFAEnabled}
                      onToggle={() => toast('2FA management coming soon')} />
                  </div>
                </div>

                {/* login history */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <SectionHeader icon={FiClock} title="Recent Logins" />
                  {(user.loginHistory || []).slice(0,5).map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div>
                        <p className="text-white text-sm">{h.ip}</p>
                        <p className="text-gray-400 text-xs">{h.userAgent?.slice(0,40)}...</p>
                      </div>
                      <p className="text-gray-500 text-xs whitespace-nowrap ml-4">
                        {new Date(h.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                  {(!user.loginHistory || user.loginHistory.length === 0) && (
                    <p className="text-gray-500 text-sm">No login history available.</p>
                  )}
                </div>
              </div>
            )}

            {/* ══════ SETTINGS ══════ */}
            {tab === 'settings' && (
              <div className="space-y-4">

                {/* language */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <SectionHeader icon={FiGlobe} title="Language & Region" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                    {LANGUAGES.map(lang => (
                      <button key={lang.code}
                        onClick={() => setForm(f => ({...f, language: lang.code}))}
                        className={`py-3 px-3 rounded-lg text-sm font-bold transition border-2 ${
                          form.language === lang.code
                            ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                            : 'border-gray-700 text-gray-300 hover:border-gray-500'
                        }`}>
                        {lang.flag} {lang.label}
                      </button>
                    ))}
                  </div>

                  {/* currency */}
                  <p className="text-gray-400 text-sm mb-2">Preferred Currency</p>
                  <div className="flex gap-2 flex-wrap">
                    {CURRENCIES.map(c => (
                      <button key={c}
                        onClick={() => setForm(f => ({...f, currency: c}))}
                        className={`py-2 px-4 rounded-lg text-sm font-bold transition border-2 ${
                          form.currency === c
                            ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* notifications */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <SectionHeader icon={FiBell} title="Notifications" />
                  <div className="space-y-4">
                    <NotifRow label="Email Notifications" sub="Deposits, withdrawals, promotions"
                      enabled={form.emailNotifications}
                      onToggle={() => setForm(f => ({...f, emailNotifications: !f.emailNotifications}))} />
                    <NotifRow label="SMS Notifications" sub="Security alerts, large transactions"
                      enabled={form.smsNotifications}
                      onToggle={() => setForm(f => ({...f, smsNotifications: !f.smsNotifications}))} />
                  </div>
                </div>

                <button onClick={saveProfile}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-xl transition">
                  Save Settings
                </button>
              </div>
            )}

            {/* ══════ ACTIVITY ══════ */}
            {tab === 'activity' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Total Deposited"  value={`$${(user.totalDeposited||0).toFixed(2)}`} color="#10b981" />
                  <StatCard label="Total Withdrawn"  value={`$${(user.totalWithdrawn||0).toFixed(2)}`} color="#ef4444" />
                  <StatCard label="Total Bets"       value={`$${(user.vip?.totalBets||0).toFixed(2)}`} color="#8b5cf6" />
                  <StatCard label="VIP Level"        value={vipLabels[vipLevel]}                         color={vipColors[vipLevel]} />
                </div>

                <div className="bg-gray-800 rounded-xl p-6">
                  <SectionHeader icon={FiDollarSign} title="Quick Actions" />
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label:'Deposit',    href:'/deposit',      color:'bg-green-600 hover:bg-green-500' },
                      { label:'Withdraw',   href:'/withdraw',     color:'bg-blue-600  hover:bg-blue-500'  },
                      { label:'Verify KYC', href:'/kyc',          color:'bg-yellow-500 hover:bg-yellow-400 text-black' },
                      { label:'View Games', href:'/games',         color:'bg-purple-600 hover:bg-purple-500' },
                    ].map(a => (
                      <a key={a.label} href={a.href}
                        className={`${a.color} text-white font-bold py-3 rounded-lg text-center text-sm transition`}>
                        {a.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        <div className="h-8" />
      </div>
    </div>
  );
}

/* ── tiny reusable sub-components ── */

function Field({ icon: Icon, label, value, edit, onChange, readonlyNote }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-1 flex items-center gap-1">
        <Icon size={12} /> {label}
      </p>
      {edit ? (
        <input
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <div className="bg-gray-700/50 px-4 py-3 rounded-lg flex items-center justify-between">
          <span className="text-white">{value || '—'}</span>
          {readonlyNote && <span className="text-gray-500 text-xs">{readonlyNote}</span>}
        </div>
      )}
    </div>
  );
}

function PwdField({ label, value, show, onToggle, onChange }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-700 text-white px-4 py-3 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        <button onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
          {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Toggle({ enabled, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-yellow-500' : 'bg-gray-600'}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

function NotifRow({ label, sub, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white text-sm font-bold">{label}</p>
        <p className="text-gray-400 text-xs">{sub}</p>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} />
    </div>
  );
}
