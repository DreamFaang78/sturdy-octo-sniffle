'use client';

import React, { useState } from 'react';
import { 
  MessageSquare, 
  PhoneMissed, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Lead, Profile, WhatsAppTemplateType } from '@/lib/types';

interface QuickWhatsAppButtonsProps {
  lead: Lead;
  currentUser?: Profile;
  onSuccess?: (msg: string) => void;
  onError?: (err: string) => void;
  compact?: boolean;
}

export default function QuickWhatsAppButtons({
  lead,
  currentUser,
  onSuccess,
  onError,
  compact = false,
}: QuickWhatsAppButtonsProps) {
  const [sendingType, setSendingType] = useState<WhatsAppTemplateType | null>(null);
  const [lastSent, setLastSent] = useState<{ type: WhatsAppTemplateType; waLink: string } | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const hasPhone = Boolean(lead?.phone && lead.phone.replace(/[^0-9]/g, '').length >= 10);

  const handleSend = async (type: WhatsAppTemplateType) => {
    if (!hasPhone) {
      const err = 'Lead record does not have a valid phone number.';
      setInlineFeedback({ type: 'error', message: err });
      if (onError) onError(err);
      return;
    }

    setSendingType(type);
    setInlineFeedback(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          lead,
          callerId: currentUser?.id,
          callerName: currentUser?.name,
          templateType: type,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorText = data.error || 'Failed to dispatch WhatsApp message via AiSensy.';
        setInlineFeedback({ type: 'error', message: errorText });
        if (onError) onError(errorText);
      } else {
        const successText = `WhatsApp sent to ${lead.name || 'lead'}!`;
        setLastSent({ type, waLink: data.waLink });
        setInlineFeedback({ type: 'success', message: successText });
        if (onSuccess) onSuccess(successText);
      }
    } catch (err: any) {
      const errorText = err.message || 'Network error while contacting WhatsApp API.';
      setInlineFeedback({ type: 'error', message: errorText });
      if (onError) onError(errorText);
    } finally {
      setSendingType(null);
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span>Quick WhatsApp Message (AiSensy)</span>
        </div>
        {!hasPhone && (
          <span className="text-[11px] font-mono text-rose-400 flex items-center space-x-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Missing Phone Number</span>
          </span>
        )}
      </div>

      {/* 3 WhatsApp Green Buttons Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        
        {/* 1. Not Picked */}
        <button
          type="button"
          disabled={!hasPhone || sendingType !== null}
          onClick={() => handleSend('not_picked')}
          title={!hasPhone ? 'Lead has no phone number' : 'Send Not Picked WhatsApp nudge'}
          className={`relative p-3 rounded-xl border flex items-center justify-center space-x-2 transition shadow-md font-semibold text-xs ${
            !hasPhone
              ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
              : sendingType === 'not_picked'
              ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/50'
              : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 hover:scale-[1.02] active:scale-95'
          }`}
        >
          {sendingType === 'not_picked' ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
          ) : (
            <PhoneMissed className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">
            {sendingType === 'not_picked' ? 'Sending...' : 'Not Picked'}
          </span>
        </button>

        {/* 2. Follow-Up */}
        <button
          type="button"
          disabled={!hasPhone || sendingType !== null}
          onClick={() => handleSend('follow_up')}
          title={!hasPhone ? 'Lead has no phone number' : 'Send 7-Day Follow-Up WhatsApp package info'}
          className={`relative p-3 rounded-xl border flex items-center justify-center space-x-2 transition shadow-md font-semibold text-xs ${
            !hasPhone
              ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
              : sendingType === 'follow_up'
              ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/50'
              : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 hover:scale-[1.02] active:scale-95'
          }`}
        >
          {sendingType === 'follow_up' ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
          ) : (
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">
            {sendingType === 'follow_up' ? 'Sending...' : 'Follow-Up'}
          </span>
        </button>

        {/* 3. Order Confirmed */}
        <button
          type="button"
          disabled={!hasPhone || sendingType !== null}
          onClick={() => handleSend('order_confirmed')}
          title={!hasPhone ? 'Lead has no phone number' : 'Send Order Confirmation WhatsApp template'}
          className={`relative p-3 rounded-xl border flex items-center justify-center space-x-2 transition shadow-md font-semibold text-xs ${
            !hasPhone
              ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
              : sendingType === 'order_confirmed'
              ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/50'
              : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 hover:scale-[1.02] active:scale-95'
          }`}
        >
          {sendingType === 'order_confirmed' ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">
            {sendingType === 'order_confirmed' ? 'Sending...' : 'Order Confirmed'}
          </span>
        </button>

      </div>

      {/* Inline Feedback Banner */}
      {inlineFeedback && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center justify-between animate-in fade-in duration-150 ${
            inlineFeedback.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {inlineFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{inlineFeedback.message}</span>
          </div>

          {lastSent && inlineFeedback.type === 'success' && (
            <a
              href={lastSent.waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline shrink-0 ml-2"
            >
              <span>Open in WhatsApp</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
