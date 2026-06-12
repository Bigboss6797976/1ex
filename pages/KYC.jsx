import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FiUpload, FiCheck, FiAlertCircle, FiShield,
  FiUser, FiCalendar, FiMapPin, FiFile, FiX
} from 'react-icons/fi';

const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

/* ─ step config ─ */
const STEPS = [
  { id: 'personal', label: 'Personal', icon: FiUser       },
  { id: 'document', label: 'Document', icon: FiFile        },
  { id: 'selfie',   label: 'Selfie',   icon: FiShield      },
  { id: 'review',   label: 'Review',   icon: FiCheck       },
];

const ID_TYPES = [
  { value:'passport',       label:'🛂 Passport'       },
  { value:'national_id',    label:'🪪 National ID'    },
  { value:'driver_license', label:'🚗 Driver License' },
];

const COUNTRIES = [
  'Cambodia','China','Vietnam','Thailand','Indonesia',
  'Philippines','Malaysia','Singapore','Myanmar',
  'United States','United Kingdom','Australia','Other',
];

/* ─────────────── main component ─────────────── */
export default function KYC() {
  const [step,   setStep]   = useState(0); // 0-3
  const [status, setStatus] = useState(null); // null | 'submitting' | 'submitted'

  const [personal, setPersonal] = useState({
    fullName:'', dateOfBirth:'', country:'', city:'', address:'', postalCode:'',
  });
  const [doc, setDoc] = useState({
    idType: 'passport',
    frontFile: null, frontPreview: null,
    backFile:  null, backPreview:  null,
  });
  const [selfie, setSelfie] = useState({ file: null, preview: null });

  const frontRef  = useRef();
  const backRef   = useRef();
  const selfieRef = useRef();

  /* ── helpers ── */
  const pickFile = (ref) => ref.current?.click();

  const handleFile = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5 MB)'); return; }

    const preview = URL.createObjectURL(file);

    if (type === 'front')  setDoc(d => ({ ...d, frontFile: file, frontPreview: preview }));
    if (type === 'back')   setDoc(d => ({ ...d, backFile: file,  backPreview:  preview }));
    if (type === 'selfie') setSelfie({ file, preview });
  };

  /* ── validate each step ── */
  const canNext = () => {
    if (step === 0) return personal.fullName && personal.dateOfBirth && personal.country && personal.city;
    if (step === 1) return doc.frontFile && doc.backFile;
    if (step === 2) return selfie.file;
    return true;
  };

  /* ── submit ── */
  const submit = async () => {
    setStatus('submitting');
    try {
      const fd = new FormData();
      Object.entries(personal).forEach(([k,v]) => fd.append(k, v));
      fd.append('idType', doc.idType);
      fd.append('frontDocument',  doc.frontFile);
      fd.append('backDocument',   doc.backFile);
      fd.append('selfieDocument', selfie.file);

      await API.post('/user/kyc/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setStatus('submitted');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Submission failed');
      setStatus(null);
    }
  };

  /* ── submitted screen ── */
  if (status === 'submitted') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-800 rounded-2xl p-10 text-center max-w-sm w-full">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <FiCheck size={40} className="text-green-400" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Submitted!</h2>
        <p className="text-gray-400 mb-6">
          Your documents have been submitted for review. We'll notify you within 24–48 hours.
        </p>
        <a href="/profile"
          className="block bg-yellow-500 text-black font-bold py-3 rounded-xl text-center">
          Back to Profile
        </a>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-16">

      {/* ── header ── */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-8 text-center">
        <FiShield size={36} className="text-yellow-400 mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Identity Verification</h1>
        <p className="text-blue-300 text-sm mt-1">
          Required to unlock withdrawals and full account features
        </p>
      </div>

      {/* ── step bar ── */}
      <div className="max-w-lg mx-auto px-4 mt-6">
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                  i < step   ? 'bg-green-500 text-white'  :
                  i === step ? 'bg-yellow-500 text-black' :
                               'bg-gray-700 text-gray-400'
                }`}>
                  {i < step ? <FiCheck size={16} /> : <s.icon size={16} />}
                </div>
                <span className={`text-xs font-bold ${
                  i <= step ? 'text-yellow-400' : 'text-gray-500'
                }`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 -mt-5 transition-colors ${
                  i < step ? 'bg-green-500' : 'bg-gray-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity:0, x: 30 }}
            animate={{ opacity:1, x:  0 }}
            exit   ={{ opacity:0, x:-30 }}
            transition={{ duration: 0.2 }}>

            {/* ══════ STEP 0 – Personal Info ══════ */}
            {step === 0 && (
              <div className="bg-gray-800 rounded-xl p-6 space-y-4">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <FiUser className="text-yellow-400" /> Personal Information
                </h2>

                <Input label="Full Name (as on ID)" icon={FiUser}
                  value={personal.fullName}
                  onChange={v => setPersonal(p => ({...p, fullName:v}))}
                  placeholder="e.g. John Smith" />

                <Input label="Date of Birth" icon={FiCalendar} type="date"
                  value={personal.dateOfBirth}
                  onChange={v => setPersonal(p => ({...p, dateOfBirth:v}))} />

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Country</label>
                  <select
                    value={personal.country}
                    onChange={e => setPersonal(p => ({...p, country: e.target.value}))}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500">
                    <option value="">Select country...</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <Input label="City" icon={FiMapPin}
                  value={personal.city}
                  onChange={v => setPersonal(p => ({...p, city:v}))}
                  placeholder="Your city" />

                <Input label="Address (optional)" icon={FiMapPin}
                  value={personal.address}
                  onChange={v => setPersonal(p => ({...p, address:v}))}
                  placeholder="Street address" />

                <Input label="Postal Code (optional)" icon={FiMapPin}
                  value={personal.postalCode}
                  onChange={v => setPersonal(p => ({...p, postalCode:v}))}
                  placeholder="Postal / ZIP code" />
              </div>
            )}

            {/* ══════ STEP 1 – Document ══════ */}
            {step === 1 && (
              <div className="bg-gray-800 rounded-xl p-6 space-y-5">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <FiFile className="text-yellow-400" /> Upload ID Document
                </h2>

                {/* ID type selector */}
                <div>
                  <p className="text-gray-400 text-xs mb-2">Document Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ID_TYPES.map(t => (
                      <button key={t.value}
                        onClick={() => setDoc(d => ({...d, idType: t.value}))}
                        className={`py-2 px-2 rounded-lg text-sm font-bold border-2 transition ${
                          doc.idType === t.value
                            ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                            : 'border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* front */}
                <UploadZone
                  label="Front of Document"
                  hint="Clear photo — all four corners visible"
                  preview={doc.frontPreview}
                  onPick={() => pickFile(frontRef)}
                  onClear={() => setDoc(d => ({...d, frontFile:null, frontPreview:null}))}
                />
                <input ref={frontRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => handleFile(e,'front')} />

                {/* back */}
                <UploadZone
                  label="Back of Document"
                  hint="Required for national ID and driver license"
                  preview={doc.backPreview}
                  onPick={() => pickFile(backRef)}
                  onClear={() => setDoc(d => ({...d, backFile:null, backPreview:null}))}
                />
                <input ref={backRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => handleFile(e,'back')} />

                <InfoBox text="Accepted: JPG, PNG, PDF — max 5 MB per file." />
              </div>
            )}

            {/* ══════ STEP 2 – Selfie ══════ */}
            {step === 2 && (
              <div className="bg-gray-800 rounded-xl p-6 space-y-5">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <FiShield className="text-yellow-400" /> Selfie with Document
                </h2>

                <InfoBox text="Take a clear selfie holding your ID document next to your face." />

                <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
                  <li>Hold the document clearly visible</li>
                  <li>Good lighting — no glare or shadows</li>
                  <li>Your face and document must both be clear</li>
                  <li>Do not cover any part of your face</li>
                </ul>

                <UploadZone
                  label="Selfie Photo"
                  hint="Face + ID document visible in one photo"
                  preview={selfie.preview}
                  onPick={() => pickFile(selfieRef)}
                  onClear={() => setSelfie({ file:null, preview:null })}
                />
                <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden"
                  onChange={e => handleFile(e,'selfie')} />
              </div>
            )}

            {/* ══════ STEP 3 – Review ══════ */}
            {step === 3 && (
              <div className="bg-gray-800 rounded-xl p-6 space-y-5">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <FiCheck className="text-yellow-400" /> Review & Submit
                </h2>

                {/* summary */}
                <div className="space-y-3">
                  <ReviewRow label="Full Name"     value={personal.fullName} />
                  <ReviewRow label="Date of Birth" value={personal.dateOfBirth} />
                  <ReviewRow label="Country"       value={personal.country} />
                  <ReviewRow label="City"          value={personal.city} />
                  <ReviewRow label="ID Type"       value={ID_TYPES.find(t=>t.value===doc.idType)?.label} />
                  <ReviewRow label="Front Doc"     value={doc.frontFile?.name} green />
                  <ReviewRow label="Back Doc"      value={doc.backFile?.name}  green />
                  <ReviewRow label="Selfie"        value={selfie.file?.name}   green />
                </div>

                {/* mini previews */}
                <div className="grid grid-cols-3 gap-2">
                  {[doc.frontPreview, doc.backPreview, selfie.preview]
                    .filter(Boolean)
                    .map((src, i) => (
                      <img key={i} src={src} alt=""
                        className="w-full h-24 object-cover rounded-lg border border-gray-600" />
                    ))}
                </div>

                <InfoBox
                  text="By submitting, you confirm all information is accurate. Processing takes 24–48 hours."
                  type="warning" />
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* ── nav buttons ── */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition">
              ← Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              disabled={!canNext()}
              onClick={() => setStep(s => s + 1)}
              className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600
                text-black disabled:text-gray-400 font-bold rounded-xl transition">
              Next →
            </button>
          ) : (
            <button
              disabled={status === 'submitting'}
              onClick={submit}
              className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600
                text-white font-bold rounded-xl transition">
              {status === 'submitting' ? 'Submitting...' : '✓ Submit KYC'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── sub-components ── */

function Input({ label, icon: Icon, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <div>
      <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
    </div>
  );
}

function UploadZone({ label, hint, preview, onPick, onClear }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      {preview ? (
        <div className="relative">
          <img src={preview} alt="preview"
            className="w-full h-44 object-cover rounded-xl border-2 border-green-500" />
          <button onClick={onClear}
            className="absolute top-2 right-2 bg-red-500 rounded-full p-1 text-white hover:bg-red-600">
            <FiX size={14} />
          </button>
          <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <FiCheck size={10} /> Uploaded
          </div>
        </div>
      ) : (
        <button onClick={onPick}
          className="w-full h-44 border-2 border-dashed border-gray-600 rounded-xl
            flex flex-col items-center justify-center gap-3
            hover:border-yellow-500 hover:bg-yellow-500/5 transition">
          <FiUpload size={28} className="text-gray-400" />
          <span className="text-gray-300 font-bold text-sm">Tap to upload</span>
          <span className="text-gray-500 text-xs text-center px-6">{hint}</span>
        </button>
      )}
    </div>
  );
}

function InfoBox({ text, type = 'info' }) {
  const styles = type === 'warning'
    ? 'bg-yellow-900/40 border-yellow-600 text-yellow-200'
    : 'bg-blue-900/40 border-blue-600 text-blue-200';
  return (
    <div className={`border-l-4 p-3 rounded text-sm flex gap-2 ${styles}`}>
      <FiAlertCircle className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

function ReviewRow({ label, value, green }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-700">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-bold ${green ? 'text-green-400' : 'text-white'}`}>
        {value || '—'}
      </span>
    </div>
  );
}
