'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Send, 
  Image as ImageIcon, 
  Truck, 
  PhoneCall, 
  AlertTriangle, 
  Sparkles,
  Info,
  Calendar,
  ExternalLink
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
  const [isSendingStep1, setIsSendingStep1] = useState(false);
  const [isSendingStep2, setIsSendingStep2] = useState(false);
  const [isSendingStep3, setIsSendingStep3] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Step 1 Trigger
  const handleStep1Send = async () => {
    setIsSendingStep1(true);
    const updated = await triggerStep1OrderConfirmation(lead, journey);
    setJourney(updated);
    setIsSendingStep1(false);
    showFeedback('Step 1: Order confirmation WhatsApp sent!');
    if (onUpdate) onUpdate();
  };

  // Step 2 Trigger
  const handleStep2Send = async () => {
    const finalUrl = customChartInput.trim() || selectedChartUrl;
    setIsSendingStep2(true);
    const updated = await attachDietChartAndSend(lead, journey, finalUrl);
    setJourney(updated);
    setIsSendingStep2(false);
    showFeedback('Step 2: Diet Chart image WhatsApp dispatched!');
    if (onUpdate) onUpdate();
  };

  // Step 3 Dispatch Trigger
  const handleStep3DispatchSend = async () => {
    setIsSendingStep3(true);
    const updated = await triggerStep3Dispatch(lead, journey);
    setJourney(updated);
    setIsSendingStep3(false);
    showFeedback('Step 3: Dispatch message sent & Post-dispatch check-in call task created!');
    if (onUpdate) onUpdate();
  };

  // Step 3 Call Task Complete
  const handleStep3CallComplete = () => {
    const updated = completeStep3CallTask(journey);
    setJourney(updated);
    showFeedback('Post-dispatch check-in call marked complete!');
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
            <h2 className="text-base font-bold text-white tracking-tight">Post-Conversion Patient Care Journey</h2>
            <p className="text-xs text-slate-400">3-Step mandatory care checklist & WhatsApp automation timeline</p>
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
                    Sent
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded uppercase border border-amber-500/30">
                    Pending Trigger
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Fires automatically via AiSensy API the moment status is marked Converted.
              </p>
              {journey.step1_sent_at && (
                <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>Dispatched on: {new Date(journey.step1_sent_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleStep1Send}
            disabled={isSendingStep1}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-teal-500/10 hover:bg-teal-500 text-teal-300 hover:text-slate-950 text-xs font-semibold rounded-lg transition border border-teal-500/30 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{journey.step1_status === 'sent' ? 'Resend WhatsApp' : 'Send WhatsApp Now'}</span>
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
                      Sent
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded uppercase border border-blue-500/30">
                      Scheduled for Next Day ({journey.step2_scheduled_for || 'Tomorrow'})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Scheduled to send automatically the next calendar day. Requires diet chart image attachment.
                </p>
                {journey.step2_sent_at && (
                  <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Dispatched on: {new Date(journey.step2_sent_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleStep2Send}
              disabled={isSendingStep2}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-teal-500/10 hover:bg-teal-500 text-teal-300 hover:text-slate-950 text-xs font-semibold rounded-lg transition border border-teal-500/30 shrink-0"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{journey.step2_status === 'sent' ? 'Resend Diet Chart' : 'Send Image WhatsApp Now'}</span>
            </button>
          </div>

          {/* AISENSY MEDIA TEMPLATE NOTICE FLAG */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300/90 flex items-start space-x-2">
            <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-300">AiSensy Template Requirement Notice: </span>
              Sending a diet chart image via AiSensy requires an approved template supporting an <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200 font-mono">IMAGE</code> header (e.g. campaign <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200 font-mono">diet_chart_notification</code>) created & approved on your AiSensy dashboard.
            </div>
          </div>

          {/* Diet Chart Image Selector */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Select Patient Diet Chart Image</label>
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
            <div className="pt-2">
              <input
                type="text"
                value={customChartInput}
                onChange={(e) => setCustomChartInput(e.target.value)}
                placeholder="Or paste custom image URL (https://...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
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
                  <span className="font-bold text-white text-sm">Step 3: Dispatch Message & Same-Day Check-in Call</span>
                  {journey.step3_dispatch_status === 'sent' ? (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded uppercase border border-emerald-500/30">
                      Dispatched
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded uppercase">
                      Trigger on Shipped
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Fires when order is marked shipped/delivered: auto-sends WhatsApp dispatch alert AND creates a same-day call task (&ldquo;Post-dispatch check-in&rdquo;) for the caller.
                </p>
              </div>
            </div>

            <button
              onClick={handleStep3DispatchSend}
              disabled={isSendingStep3}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-teal-500/10 hover:bg-teal-500 text-teal-300 hover:text-slate-950 text-xs font-semibold rounded-lg transition border border-teal-500/30 shrink-0"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Trigger Dispatch & Task</span>
            </button>
          </div>

          {/* CALL TASK STATUS ROW */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <PhoneCall className="w-4 h-4 text-purple-400" />
              <div>
                <span className="font-semibold text-white">Call Task: Post-dispatch check-in</span>
                <div className="text-[10px] text-slate-400">Assigned to original caller ({lead.assignee?.name || 'Telecaller'})</div>
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
