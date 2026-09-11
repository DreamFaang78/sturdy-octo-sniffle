'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Image as ImageIcon, 
  Truck, 
  PhoneCall, 
  AlertCircle, 
  Sparkles,
  Info,
  Layers
} from 'lucide-react';
import { Lead, PatientCareJourney } from '@/lib/types';
import { 
  getOrCreateCareJourney, 
  triggerStep1OrderConfirmation, 
  attachDietChartAndSend, 
  triggerStep3Dispatch, 
  completeStep3CallTask 
} from '@/lib/care-journey';

interface PatientCareChecklistProps {
  lead: Lead;
  onUpdate?: () => void;
}

const PRESET_DIET_CHARTS = [
  {
    name: 'Diabetes & Metabolic Care Diet Chart',
    url: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800',
  },
  {
    name: 'Senior Care High-Protein Nutritional Plan',
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  },
  {
    name: 'Thyroid & Weight Management Protocol',
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
  },
];

export default function PatientCareChecklist({ lead, onUpdate }: PatientCareChecklistProps) {
  const [journey, setJourney] = useState<PatientCareJourney>(() => getOrCreateCareJourney(lead.id));
  const [selectedChartUrl, setSelectedChartUrl] = useState<string>(
    journey.step2_diet_chart_url || PRESET_DIET_CHARTS[0].url
  );
  const [customChartInput, setCustomChartInput] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Step 1 Trigger (wa.me link)
  const handleStep1Send = () => {
    const updated = triggerStep1OrderConfirmation(lead, journey);
    setJourney(updated);
    showFeedback('Opened wa.me link & recorded Step 1 manual send.');
    if (onUpdate) onUpdate();
  };

  // Step 2 Trigger (wa.me link + image attachment note)
  const handleStep2Send = () => {
    const finalUrl = customChartInput.trim() || selectedChartUrl;
    const updated = attachDietChartAndSend(lead, journey, finalUrl);
    setJourney(updated);
    showFeedback('Opened wa.me link & recorded Step 2 manual send.');
    if (onUpdate) onUpdate();
  };

  // Step 3 Dispatch Trigger (wa.me link)
  const handleStep3DispatchSend = () => {
    const updated = triggerStep3Dispatch(lead, journey);
    setJourney(updated);
    showFeedback('Opened wa.me link & created Post-dispatch check-in call task.');
    if (onUpdate) onUpdate();
  };

  // Step 3 Call Task Complete
  const handleStep3CallComplete = () => {
    const updated = completeStep3CallTask(journey);
    setJourney(updated);
    showFeedback('Post-dispatch check-in call marked complete.');
    if (onUpdate) onUpdate();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Post-Conversion Patient Care Checklist</h2>
            <p className="text-xs text-slate-400">3-Step manual WhatsApp Business & call task timeline</p>
          </div>
        </div>

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="px-3 py-1 bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-lg animate-in fade-in">
            {actionFeedback}
          </div>
        )}
      </div>

      {/* THREE STEP CHECKLIST TIMELINE */}
      <div className="mt-6 space-y-6">
        
        {/* STEP 1: Order Confirmation WhatsApp */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-xl text-xs font-bold ${
              journey.step1_status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              1
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">Step 1: Order Confirmation WhatsApp</span>
                {journey.step1_status === 'sent' ? (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded uppercase border border-emerald-500/30">
                    Sent (manual) — Self-reported
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded uppercase border border-amber-500/30">
                    Action Available
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Appears when status becomes Converted. Opens wa.me pre-filled chat with order confirmation.
              </p>
              {journey.step1_sent_at && (
                <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>Logged: {new Date(journey.step1_sent_at).toLocaleString()} (Unverified delivery)</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleStep1Send}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open WhatsApp Chat</span>
          </button>
        </div>

        {/* STEP 2: Diet Chart (Image) WhatsApp (Scheduled Next Calendar Day) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-xl text-xs font-bold ${
                journey.step2_status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                2
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">Step 2: Diet Chart (Image) WhatsApp</span>
                  {journey.step2_status === 'sent' ? (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded uppercase border border-emerald-500/30">
                      Sent (manual) — Self-reported
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded uppercase border border-blue-500/30">
                      Due Next Day ({journey.step2_scheduled_for || 'Tomorrow'})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Surfaces as due next calendar day. Review patient diet chart image below before sending.
                </p>
                {journey.step2_sent_at && (
                  <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Logged: {new Date(journey.step2_sent_at).toLocaleString()} (Unverified delivery)</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleStep2Send}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open WhatsApp Chat</span>
            </button>
          </div>

          {/* MANUAL 2-TAP ATTACHMENT NOTICE FLAG */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start space-x-2">
            <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-300">2-Tap Manual Action Note: </span>
              Clicking &quot;Open WhatsApp Chat&quot; pre-fills the text in WhatsApp Business. You must <strong>attach the diet chart image manually</strong> in WhatsApp before hitting send.
            </div>
          </div>

          {/* Diet Chart Image Selector & Preview */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">Patient Diet Chart Image Preview</label>
              <span className="text-[10px] text-slate-500 font-mono">Select image for patient</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PRESET_DIET_CHARTS.map((chart) => (
                <button
                  key={chart.name}
                  type="button"
                  onClick={() => {
                    setSelectedChartUrl(chart.url);
                    setCustomChartInput('');
                  }}
                  className={`p-2 rounded-lg border text-left text-xs transition flex flex-col justify-between ${
                    selectedChartUrl === chart.url && !customChartInput
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{chart.name}</span>
                  <span className="text-[10px] text-slate-500 mt-1 font-mono">Preset Chart</span>
                </button>
              ))}
            </div>

            {/* Custom URL Input */}
            <div className="pt-1">
              <input
                type="text"
                value={customChartInput}
                onChange={(e) => setCustomChartInput(e.target.value)}
                placeholder="Or paste custom diet chart image URL..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Image Preview Thumbnail */}
            {(customChartInput || selectedChartUrl) && (
              <div className="mt-2 flex items-center space-x-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <img
                  src={customChartInput || selectedChartUrl}
                  alt="Diet Chart Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-700 shrink-0"
                />
                <div className="text-xs text-slate-300">
                  <div className="font-semibold text-white">Active Diet Chart Image</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-xs">{customChartInput || selectedChartUrl}</div>
                  <a
                    href={customChartInput || selectedChartUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-teal-400 hover:underline inline-flex items-center space-x-1 mt-1"
                  >
                    <span>View Full Image</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: Dispatch Message + Same-Day Follow-Up Call Task */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-xl text-xs font-bold ${
                journey.step3_call_task_status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
              }`}>
                3
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">Step 3: Dispatch Notice & Same-Day Call Task</span>
                  {journey.step3_dispatch_status === 'sent' ? (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded uppercase border border-emerald-500/30">
                      Sent (manual) — Self-reported
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded uppercase">
                      Action on Dispatch
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Surfaces on dispatch: opens wa.me dispatch notice AND creates a same-day call task (&ldquo;Post-dispatch check-in&rdquo;) in caller panel.
                </p>
              </div>
            </div>

            <button
              onClick={handleStep3DispatchSend}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open WhatsApp Chat</span>
            </button>
          </div>

          {/* CALL TASK STATUS ROW */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <PhoneCall className="w-4 h-4 text-purple-400" />
              <div>
                <span className="font-semibold text-white">Call Task: Post-dispatch check-in</span>
                <div className="text-[10px] text-slate-400">Assigned to caller ({lead.assignee?.name || 'Telecaller'})</div>
              </div>
            </div>

            {journey.step3_call_task_status === 'completed' ? (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Call Task Completed</span>
              </span>
            ) : (
              <button
                onClick={handleStep3CallComplete}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition shadow"
              >
                Mark Call Complete
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
