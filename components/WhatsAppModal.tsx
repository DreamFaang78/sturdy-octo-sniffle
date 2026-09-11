'use client';

import React, { useState } from 'react';
import { X, MessageSquare, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { Lead } from '@/lib/types';
import { sendAiSensyWhatsAppMessage } from '@/lib/aisensy';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
}

export default function WhatsAppModal({ isOpen, onClose, lead }: WhatsAppModalProps) {
  const [template, setTemplate] = useState('welcome_lead');
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !lead) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatusMsg(null);

    const res = await sendAiSensyWhatsAppMessage({
      destinationPhone: lead.phone,
      campaignName: template,
      userName: lead.name,
      leadId: lead.id,
      sourceParams: {
        param1: lead.name,
        param2: template === 'rto_address_reconfirm' ? 'Delivery Address Update' : 'Hommed Diagnostics',
      },
    });

    setSending(false);
    if (res.success) {
      setStatusMsg({ type: 'success', text: `WhatsApp message dispatched to ${lead.phone} via AiSensy.` });
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1500);
    } else {
      setStatusMsg({ type: 'error', text: res.message || 'Failed to dispatch WhatsApp message.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">AiSensy WhatsApp Message</h3>
              <p className="text-xs text-slate-400">Send automated template to {lead.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lead Info Pill */}
        <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">{lead.name}</div>
            <div className="text-xs text-slate-400">{lead.phone}</div>
          </div>
          <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 text-[10px] font-semibold uppercase tracking-wider rounded border border-teal-500/20">
            {lead.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Approved AiSensy Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="welcome_lead">Welcome & Intro Template (New Lead)</option>
              <option value="followup_reminder_patient">7-Day Follow-Up Reminder to Patient</option>
              <option value="rto_address_reconfirm">RTO Delivery Address Re-confirmation</option>
              <option value="custom_caller_nudge">Call Attempt Notification</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Template Preview</label>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-mono space-y-1">
              {template === 'welcome_lead' && (
                <p>Hello {lead.name}, thank you for reaching out to Hommed Diagnostics! Our medical advisor will connect with you shortly for your health checkup inquiry.</p>
              )}
              {template === 'followup_reminder_patient' && (
                <p>Hi {lead.name}, following up on your requested health package with Hommed! Would you like to schedule your sample collection slot today?</p>
              )}
              {template === 'rto_address_reconfirm' && (
                <p>Dear {lead.name}, your report/sample kit was returned due to address mismatch. Please reply with your updated pincode and address to re-ship immediately.</p>
              )}
              {template === 'custom_caller_nudge' && (
                <p>Hi {lead.name}, we tried calling you regarding your Hommed Health Inquiry. Please reply with a preferred call back time!</p>
              )}
            </div>
          </div>

          {statusMsg && (
            <div className={`p-3 rounded-lg flex items-center space-x-2 text-xs font-medium ${
              statusMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold rounded-lg transition shadow"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Sending...' : 'Send WhatsApp Message'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
