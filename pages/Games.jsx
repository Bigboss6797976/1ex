import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FiSearch, FiStar, FiTrendingUp, FiZap,
  FiGrid, FiList, FiDollarSign, FiX
} from 'react-icons/fi';

const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

/* ─ static categories ─ */
const CATEGORIES = [
  { id:'all',    label:'All Games', icon:'🎮' },
  { id:'slot',   label:'Slots',     icon:'🎰' },
  { id:'table',  label:'Table',     icon:'🃏' },
  { id:'live',   label:'Live',      icon:'📡' },
  { id:'sports', label:'Sports',    icon:'⚽' },
];

const PROVIDERS = ['All','Pragmatic Play','PG Soft','Evolution','Microgaming','NetEnt'];

/* demo games – shown if API returns nothing */
const DEMO_GAMES = Array.from({ length: 24 }, (_, i) => {
  const types = ['slot','slot','slot','table','live','sports'];
  const providers = ['Pragmatic Play','PG Soft','Evolution','Microgaming','NetEnt'];
  const names = [
    'Sweet Bonanza','Gates of Olympus','Wolf Gold','Big Bass Splash',
    'Starlight Princess','The Dog House','Crazy Time','Lightning Roulette',
    'Aviator','Baccarat','Blackjack VIP','Dragon Tiger',
    'Football Studio','Speed Baccarat','Sic Bo','Teen Patti',
    'Buffalo King','Fire Strike','Wild West Gold','Fruit Party',
    'Great Rhino','Joker King','Might of Ra','Power of Thor',
  ];
  const colors = [
    '#1e3a5f','#3d1a78','#7c0404','#0d4f3c',
    '#5c3317','#1a1a4f','#4f1a1a','#1a4f4f',
  ];
  return {
    _id: `demo_${i}`,
    name: names[i % names.length],
    type: types[i % types.length],
    provider: providers[i % providers.length],
    minBet: [1,2,5,10][i % 4],
    maxBet: [500,1000,5000][i % 3],
    rtp: 94 + (i % 6),
    volatility: ['low','medium','high'][i % 3],
    playCount: Math.floor(Math.random() * 100000),
    color: colors[i % colors.length],
    hot: i % 7 === 0,
    new: i % 9 === 0,
  };
});

/* ─────────────── component ─────────────── */
export default function Games() {
  const [games,    setGames]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('all');
  const [provider, setProvider] = useState('All');
  const [layout,   setLayout]   = useState('grid'); // grid | list
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [betModal, setBetModal] = useState(null); // game object or null

  const PER_PAGE = 12;

  /* fetch games */
  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: PER_PAGE,
        page,
        ...(category !== 'all' && { type: category }),
      };
      const { data } = await API.get('/games/list', { params });
      setGames(data.games?.length ? data.games : DEMO_GAMES.slice(0, PER_PAGE));
      setTotal(data.total || DEMO_GAMES.length);
    } catch {
      setGames(DEMO_GAMES.slice((page - 1) * PER_PAGE, page * PER_PAGE));
      setTotal(DEMO_GAMES.length);
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  /* client-side filter */
  const filtered = games.filter(g => {
    const matchSearch   = !search   || g.name.toLowerCase().includes(search.toLowerCase());
    const matchProvider = provider === 'All' || g.provider === provider;
    return matchSearch && matchProvider;
  });

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">

      {/* ── hero banner ── */}
      <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-purple-900 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-black mb-1">🎮 Casino Games</h1>
          <p className="text-blue-300 text-sm mb-5">Play real money games from top providers</p>

          {/* search bar */}
          <div className="relative max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search games..."
              className="w-full bg-gray-800 text-white pl-11 pr-4 py-3 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-500"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6">

        {/* ── category tabs ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {CATEGORIES.map(c => (
            <button key={c.id}
              onClick={() => { setCategory(c.id); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition ${
                category === c.id
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* ── toolbar ── */}
        <div className="flex items-center justify-between mb-4 gap-3">
          {/* provider filter */}
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-yellow-500 border border-gray-700">
            {PROVIDERS.map(p => <option key={p}>{p}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{total} games</span>
            {/* layout toggle */}
            <button onClick={() => setLayout(l => l === 'grid' ? 'list' : 'grid')}
              className="bg-gray-800 p-2 rounded-lg text-gray-400 hover:text-white transition">
              {layout === 'grid' ? <FiList size={18} /> : <FiGrid size={18} />}
            </button>
          </div>
        </div>

        {/* ── games grid / list ── */}
        {loading ? (
          <div className={`grid gap-4 ${layout === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-1'}`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl animate-pulse"
                style={{ height: layout === 'grid' ? 200 : 80 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-lg">No games found for "{search}"</p>
            <button onClick={() => setSearch('')}
              className="mt-4 text-yellow-400 hover:underline">Clear search</button>
          </div>
        ) : (
          <motion.div
            layout
            className={`grid gap-4 ${
              layout === 'grid'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                : 'grid-cols-1'
            }`}>
            {filtered.map((game, i) => (
              <GameCard
                key={game._id}
                game={game}
                layout={layout}
                index={i}
                onPlay={() => setBetModal(game)}
              />
            ))}
          </motion.div>
        )}

        {/* ── pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40
                text-white rounded-lg transition font-bold">
              ‹ Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p}
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-lg font-bold text-sm transition ${
                  page === p ? 'bg-yellow-500 text-black' : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}>
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40
                text-white rounded-lg transition font-bold">
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* ── bet modal ── */}
      <AnimatePresence>
        {betModal && (
          <BetModal game={betModal} onClose={() => setBetModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─ GameCard ─ */
function GameCard({ game, layout, index, onPlay }) {
  const [hovered, setHovered] = useState(false);

  if (layout === 'list') return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="bg-gray-800 rounded-xl p-4 flex items-center gap-4 hover:bg-gray-750 transition">
      {/* color swatch */}
      <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl"
        style={{ background: game.color || '#1e3a5f' }}>
        🎰
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold truncate">{game.name}</p>
        <p className="text-gray-400 text-xs">{game.provider}</p>
        <div className="flex gap-2 mt-1">
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full capitalize">
            {game.type}
          </span>
          <span className="text-xs text-green-400">RTP {game.rtp}%</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-gray-400 text-xs">Bet: ${game.minBet}–${game.maxBet}</p>
        <button onClick={onPlay}
          className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-bold px-4 py-1.5 rounded-lg transition">
          Play
        </button>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      className="relative rounded-xl overflow-hidden cursor-pointer group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPlay}>

      {/* thumbnail */}
      <div className="w-full aspect-[3/4] flex items-center justify-center text-5xl"
        style={{ background: `linear-gradient(135deg, ${game.color || '#1e3a5f'}, #111827)` }}>
        {game.type === 'slot'   && '🎰'}
        {game.type === 'table'  && '🃏'}
        {game.type === 'live'   && '📡'}
        {game.type === 'sports' && '⚽'}
      </div>

      {/* badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
        {game.hot && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <FiTrendingUp size={10} /> HOT
          </span>
        )}
        {game.new && (
          <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <FiZap size={10} /> NEW
          </span>
        )}
      </div>

      {/* hover overlay */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-3">
            <button
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-lg text-sm transition">
              Play Now
            </button>
            <p className="text-gray-300 text-xs">RTP {game.rtp}% · {game.volatility} vol.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer */}
      <div className="bg-gray-800 px-3 py-2">
        <p className="text-white text-xs font-bold truncate">{game.name}</p>
        <p className="text-gray-500 text-xs">{game.provider}</p>
      </div>
    </motion.div>
  );
}

/* ─ BetModal ─ */
function BetModal({ game, onClose }) {
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [result,  setResult]  = useState(null); // null | {won, winAmount, newBalance}

  useEffect(() => {
    API.get('/payment/balance')
      .then(r => setBalance(r.data.balance))
      .catch(() => {});
  }, []);

  const quickAmounts = [game.minBet, game.minBet * 5, game.minBet * 20, game.minBet * 100]
    .filter(a => a <= (game.maxBet || 5000));

  const placeBet = async () => {
    if (!amount || parseFloat(amount) < game.minBet) {
      return toast.error(`Minimum bet: $${game.minBet}`);
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await API.post(`/games/${game._id}/bet`, {
        amount: parseFloat(amount),
      });

      /* for demo: auto-resolve */
      const resolveRes = await API.post(`/games/test/resolve-bet/${data.bet.betId}`)
        .catch(() => null);

      if (resolveRes) {
        const r = resolveRes.data.result;
        setResult({
          won:        r.result === 'won',
          winAmount:  r.winAmount,
          newBalance: r.newBalance,
        });
        setBalance(r.newBalance);
      } else {
        toast.success('Bet placed! Result pending.');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Bet failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>

      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-white font-bold">{game.name}</h3>
            <p className="text-gray-400 text-xs">{game.provider} · RTP {game.rtp}%</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-white bg-gray-700 rounded-full p-1.5">
            <FiX size={16} />
          </button>
        </div>

        {/* result banner */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className={`px-5 py-4 text-center font-bold text-lg ${
                result.won ? 'bg-green-600' : 'bg-red-600'
              }`}>
              {result.won
                ? `🎉 You won $${result.winAmount?.toFixed(2)}!`
                : `😞 Better luck next time!`}
              <p className="text-sm font-normal mt-0.5">Balance: ${result.newBalance?.toFixed(2)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-5 py-5 space-y-4">
          {/* balance */}
          {balance !== null && (
            <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
              <span className="text-gray-400 text-sm">Your Balance</span>
              <span className="text-yellow-400 font-bold">
                <FiDollarSign size={14} className="inline" />{balance.toFixed(2)}
              </span>
            </div>
          )}

          {/* quick amounts */}
          <div>
            <p className="text-gray-400 text-xs mb-2">Bet Amount</p>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {quickAmounts.map(a => (
                <button key={a}
                  onClick={() => setAmount(a.toString())}
                  className={`py-2 rounded-lg text-sm font-bold transition ${
                    amount === a.toString()
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}>
                  ${a}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={game.minBet}
              max={game.maxBet}
              placeholder={`$${game.minBet} – $${game.maxBet}`}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-yellow-500 text-center text-lg font-bold"
            />
          </div>

          {/* potential win */}
          {amount && (
            <div className="bg-gray-800 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-gray-400 text-sm">Potential Win</span>
              <span className="text-green-400 font-bold">
                ≈ ${(parseFloat(amount || 0) * 2).toFixed(2)}
              </span>
            </div>
          )}

          <button
            disabled={loading || !amount}
            onClick={placeBet}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600
              text-black disabled:text-gray-400 font-black text-lg py-4 rounded-xl transition">
            {loading ? 'Placing Bet...' : 'Place Bet 🎲'}
          </button>

          <p className="text-gray-500 text-xs text-center">
            Min ${game.minBet} · Max ${game.maxBet} · Volatility: {game.volatility}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
