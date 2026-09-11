'use client';

import React, { useState } from 'react';
import { X, MessageSquare, ExternalLink, CheckCircle2, Info } from 'lucide-react';
import { Lead } from '@/lib/types';
import { INITIAL_WHATSAPP_TEMPLATES } from '@/lib/mockDb';
import { 
  getWhatsAppTemplate, 
  renderWhatsAppTemplateText, 
  openWhatsAppAndLogAction 
} from '@/lib/whatsapp';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  defaultTemplateKey?: string;
  currentUserRole?: string;
}

export default function WhatsAppModal({ 
  isOpen, 
  onClose, 
  lead, 
  defaultTemplateKey = 'followup_day1' 
}: WhatsAppModalProps) {
  const [selectedKey, setSelectedKey] = useState(defaultTemplateKey);
  const [copiedNotice, setCopiedNotice] = useState(false);

  if (!isOpen || !lead) return null;

  const currentTmpl = getWhatsAppTemplate(selectedKey);
  const renderedMessage = renderWhatsAppTemplateText(
    currentTmpl.text_template,
    lead.name,
    lead.campaign
  );

  const handleOpenWhatsApp = () => {
    openWhatsAppAndLogAction(
      lead.id,
      lead.phone,
      selectedKey,
      currentTmpl.label,
      'Telecaller',
      lead.name,
      lead.campaign
    );
    setCopiedNotice(true);
    setTimeout(() => {
      setCopiedNotice(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Click-to-WhatsApp Business</h3>
              <p className="text-xs text-slate-400">Pre-fill wa.me message link for {lead.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Patient Info Pill */}
        <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">{lead.name}</div>
            <div className="text-xs text-slate-400 font-mono">{lead.phone}</div>
          </div>
          <span className="px-2.5 py-0.5 bg-teal-500/10 text-teal-400 text-[10px] font-semibold uppercase tracking-wider rounded border border-teal-500/20">
            {lead.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Template Selector */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select WhatsApp Template</label>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              {INITIAL_WHATSAPP_TEMPLATES.map((tmpl) => (
                <option key={tmpl.key} value={tmpl.key}>
                  {tmpl.label} ({tmpl.key})
                </option>
              ))}
            </select>
          </div>

          {/* Rendered Live Message Preview */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Message Preview</label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
              {renderedMessage}
            </div>
          </div>

          {/* Self-Reported Notice */}
          <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Self-Reported Logging:</strong> Opens WhatsApp Business with pre-filled text. Clicking records a manual action in lead timeline.
            </span>
          </div>

          {copiedNotice && (
            <div className="p-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Opening wa.me chat & logged manual action!</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition shadow-lg hover:scale-[1.02] active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in WhatsApp Business</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
