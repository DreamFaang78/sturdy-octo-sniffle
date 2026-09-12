'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { 
  Settings, 
  Key, 
  MessageSquare, 
  Webhook, 
  Clock, 
  CheckCircle2, 
  Save, 
  Globe,
  Copy,
  Info,
  ChevronRight
} from 'lucide-react';
import { Profile, WhatsAppTemplate } from '@/lib/types';
import { INITIAL_PROFILES, INITIAL_WHATSAPP_TEMPLATES } from '@/lib/mockDb';

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[0]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(INITIAL_WHATSAPP_TEMPLATES);
  const [metaVerifyToken, setMetaVerifyToken] = useState('hommed_lead_crm_verify_token_2026');

  const [metaAppSecret, setMetaAppSecret] = useState('demo_meta_app_secret');
  const [metaAccessToken, setMetaAccessToken] = useState('demo_meta_access_token');
  const [autoAssignOnIngest, setAutoAssignOnIngest] = useState(false);
  const [day1Interval, setDay1Interval] = useState(1);
  const [day2Interval, setDay2Interval] = useState(3);
  const [day3Interval, setDay3Interval] = useState(5);
  const [day4Interval, setDay4Interval] = useState(7);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/facebook` : 'https://your-domain.vercel.app/api/webhooks/facebook';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hommed_user_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.role === 'admin') {
            setCurrentUser(parsed);
          }
        } catch (e) {}
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCopyWebhook = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(webhookUrl);
      showToast('Meta Webhook URL copied to clipboard!');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('CRM Settings saved successfully.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole="admin" userName={currentUser.name} />

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-teal-500 text-slate-950 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header */}
        <div className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Settings className="w-6 h-6 text-teal-400" />
            <span>CRM Integration & Engine Settings</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Configure Meta Webhooks, AiSensy REST API keys, and 7-day follow-up rules.</p>
        </div>

        <form onSubmit={handleSaveSettings} className="mt-8 space-y-6">
          
          {/* 1. Meta Facebook Lead Ads Webhook */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Meta Facebook Lead Ads Webhook</h3>
                  <p className="text-xs text-slate-400">Configure Meta Developer App webhook endpoint & token</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-semibold rounded border border-emerald-500/20">
                ₹0 API Cost
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Webhook Callback URL</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-teal-300 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg shrink-0 transition"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Meta Verify Token (`hub.verify_token`)</label>
                  <input
                    type="text"
                    value={metaVerifyToken}
                    onChange={(e) => setMetaVerifyToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Meta Page Access Token</label>
                  <input
                    type="password"
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center space-x-3 text-xs text-slate-300">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <p>When Meta hits your webhook, leads land in your <strong>Unassigned Queue</strong> automatically.</p>
              </div>
            </div>
          </div>

          {/* 2. AiSensy WhatsApp API & Templates Manager */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">AiSensy WhatsApp API & Templates</h3>
                  <p className="text-xs text-slate-400">Configure AiSensy REST API keys and manage the 3 1-tap message templates.</p>
                </div>
              </div>
              <a
                href="/admin/whatsapp"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow shrink-0"
              >
                <span>Edit 3 Templates & Logs</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">AiSensy API Key (`AISENSY_API_KEY`)</label>
                  <input
                    type="password"
                    placeholder="Enter AiSensy Project API Key"
                    defaultValue="demo_aisensy_api_key_2026"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">AiSensy API Endpoint</label>
                  <input
                    type="text"
                    readOnly
                    value="https://backend.aisensy.com/campaign/t1/api/v2"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>The 3 caller templates (Not Picked, Follow-Up, Order Confirmed) can be edited with live preview on the dedicated WhatsApp page.</span>
                </div>
                <a href="/admin/whatsapp" className="text-emerald-400 font-bold hover:underline whitespace-nowrap ml-2">
                  Open WhatsApp Manager →
                </a>
              </div>
            </div>
          </div>


          {/* 3. 7-Day Follow-up Cadence Rules */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Follow-up & Reminder Engine Cadence</h3>
                <p className="text-xs text-slate-400">Automatic follow-up interval spacing for Qualified leads</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <div className="text-xs text-slate-400">Stage 1</div>
                <div className="text-lg font-bold text-amber-400 mt-1">Day 1</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <div className="text-xs text-slate-400">Stage 2</div>
                <div className="text-lg font-bold text-amber-400 mt-1">Day 3</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <div className="text-xs text-slate-400">Stage 3</div>
                <div className="text-lg font-bold text-amber-400 mt-1">Day 5</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <div className="text-xs text-slate-400">Stage 4</div>
                <div className="text-lg font-bold text-amber-400 mt-1">Day 7</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>

        </form>

      </main>
    </div>
  );
}
