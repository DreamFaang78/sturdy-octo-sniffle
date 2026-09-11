'use client';

import React, { useState } from 'react';
import { Phone, Delete, X, CheckCircle2, UserCheck, AlertCircle, PhoneCall } from 'lucide-react';
import { Lead, Profile, ManualDialLog } from '@/lib/types';
import { INITIAL_LEADS, INITIAL_MANUAL_DIAL_LOGS } from '@/lib/mockDb';

interface DialpadWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: Profile;
  leads?: Lead[];
  onCallLogged?: (leadId?: string, isMatched?: boolean) => void;
}

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // If starts with 91 and has 12 digits, strip country code for comparison
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export default function DialpadWidget({
  isOpen,
  onClose,
  currentUser,
  leads = INITIAL_LEADS,
  onCallLogged,
}: DialpadWidgetProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callNotice, setCallNotice] = useState<{ message: string; type: 'match' | 'manual' } | null>(null);

  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const cleaned = pasted.replace(/[^0-9+]/g, '');
    if (cleaned) {
      setPhoneNumber(cleaned);
    }
  };

  const handleCall = () => {
    if (!phoneNumber.trim()) return;

    const rawInput = phoneNumber.trim();
    const normalizedInput = normalizePhoneNumber(rawInput);

    // Search existing leads by phone
    const matchedLead = leads.find((l) => {
      const normLeadPhone = normalizePhoneNumber(l.phone);
      return normLeadPhone === normalizedInput || l.phone.includes(normalizedInput);
    });

    const activeCallerName = currentUser?.name || 'Telecaller';
    const activeCallerId = currentUser?.id || 'user-caller-1';

    if (matchedLead) {
      // Auto-attach call attempt to existing lead
      matchedLead.phone_attempt_count = (matchedLead.phone_attempt_count || 0) + 1;
      matchedLead.last_contacted_at = new Date().toISOString();
      matchedLead.updated_at = new Date().toISOString();

      setCallNotice({
        message: `Call attached to lead: ${matchedLead.name} (${matchedLead.phone}). Call attempt #${matchedLead.phone_attempt_count} logged.`,
        type: 'match',
      });

      if (onCallLogged) {
        onCallLogged(matchedLead.id, true);
      }
    } else {
      // Log to manual dial log
      const newManualLog: ManualDialLog = {
        id: `dial-${Date.now()}`,
        caller_id: activeCallerId,
        caller_name: activeCallerName,
        phone: rawInput,
        notes: 'Ad-hoc CRM dialpad call',
        dialed_at: new Date().toISOString(),
      };
      INITIAL_MANUAL_DIAL_LOGS.unshift(newManualLog);

      setCallNotice({
        message: `No matching lead found. Logged call to ${rawInput} in General Manual Dial Log.`,
        type: 'manual',
      });

      if (onCallLogged) {
        onCallLogged(undefined, false);
      }
    }

    // Trigger native device dialer via tel: link BEFORE OS dialer takes focus
    window.location.href = `tel:${rawInput}`;

    setTimeout(() => {
      setCallNotice(null);
    }, 4000);
  };

  // Preview matching lead while typing
  const currentNormalized = normalizePhoneNumber(phoneNumber);
  const matchedPreview = phoneNumber.length >= 5
    ? leads.find((l) => normalizePhoneNumber(l.phone).includes(currentNormalized))
    : null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom duration-200">
      <div className="bg-slate-900 border border-slate-700/80 text-white rounded-3xl shadow-2xl w-80 p-5 relative overflow-hidden backdrop-blur-lg">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-100">In-CRM Dialpad</div>
              <div className="text-[10px] text-slate-400">Native Call (Zero Cost)</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Alert */}
        {callNotice && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-start space-x-2 ${
            callNotice.type === 'match'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-tight">{callNotice.message}</span>
          </div>
        )}

        {/* Match Preview Strip */}
        {matchedPreview && !callNotice && (
          <div className="mt-3 p-2 bg-slate-950/80 border border-teal-500/30 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 truncate">
              <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="font-semibold text-teal-300 truncate">{matchedPreview.name}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">Matched</span>
          </div>
        )}

        {/* Number Display Input */}
        <div className="mt-4 bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-inner">
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ''))}
            onPaste={handlePaste}
            placeholder="Type or paste number..."
            className="bg-transparent text-lg font-mono font-bold text-teal-400 w-full focus:outline-none tracking-wider placeholder:text-slate-600 placeholder:text-xs placeholder:font-sans"
          />

          {phoneNumber && (
            <button
              onClick={handleBackspace}
              className="p-1 text-slate-400 hover:text-rose-400 transition"
              title="Backspace"
            >
              <Delete className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Numeric Keypad 0-9 */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
            <button
              key={key}
              onClick={() => handleDigitClick(key)}
              className="h-12 bg-slate-800/80 hover:bg-slate-700 active:bg-teal-500 active:text-slate-950 text-slate-100 font-extrabold text-base rounded-2xl transition flex items-center justify-center shadow"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Call Action Button */}
        <div className="mt-4 flex items-center space-x-2">
          <button
            onClick={handleClear}
            className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold rounded-2xl transition"
          >
            Clear
          </button>
          <button
            onClick={handleCall}
            disabled={!phoneNumber.trim()}
            className="w-2/3 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl transition flex items-center justify-center space-x-2 shadow-lg active:scale-95"
          >
            <Phone className="w-4 h-4 fill-slate-950" />
            <span>CALL</span>
          </button>
        </div>

      </div>
    </div>
  );
}
