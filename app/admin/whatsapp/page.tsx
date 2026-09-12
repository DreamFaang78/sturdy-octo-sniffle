'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { 
  MessageSquare, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  PhoneMissed, 
  Package, 
  RefreshCw, 
  Eye, 
  Info, 
  Sliders, 
  History 
} from 'lucide-react';
import { Profile, WhatsAppTemplateType, WhatsAppTemplateRecord, WhatsAppLog } from '@/lib/types';
import { INITIAL_PROFILES } from '@/lib/mockDb';
import { DEFAULT_WHATSAPP_TEMPLATES, substituteTemplateVariables } from '@/lib/whatsapp';

const SAMPLE_LEAD = {
  name: 'Devendra Patel',
  phone: '+919876543210',
  city: 'Mumbai',
  form_id: '1054628246965195',
  campaign: 'Hommed Diagnostics Full Body Checkup',
  status: 'unassigned',
};

const TEMPLATE_CONFIG: { type: WhatsAppTemplateType; label: string; icon: any; color: string; desc: string }[] = [
  {
    type: 'not_picked',
    label: 'Not Picked Message',
    icon: PhoneMissed,
    color: 'amber',
    desc: 'Sent when the patient did not pick up the phone call to invite them to connect.',
  },
  {
    type: 'follow_up',
    label: 'Follow-Up Message',
    icon: Clock,
    color: 'blue',
    desc: 'Sent to check in on health package requirements during the 7-day cadence.',
  },
  {
    type: 'order_confirmed',
    label: 'Order Confirmed Message',
    icon: Package,
    color: 'emerald',
    desc: 'Sent immediately after order confirmation to acknowledge booking and sample collection.',
  },
];

export default function WhatsAppTemplatesAdminPage() {
  const [currentUser, setCurrentUser] = useState<Profile>(INITIAL_PROFILES[0]);
  const [activeTab, setActiveTab] = useState<WhatsAppTemplateType>('not_picked');
  const [templates, setTemplates] = useState<Record<WhatsAppTemplateType, string>>({
    not_picked: DEFAULT_WHATSAPP_TEMPLATES.not_picked.text,
    follow_up: DEFAULT_WHATSAPP_TEMPLATES.follow_up.text,
    order_confirmed: DEFAULT_WHATSAPP_TEMPLATES.order_confirmed.text,
  });
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    loadTemplatesAndLogs();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadTemplatesAndLogs = async () => {
    setIsLoading(true);
    try {
      const tmplRes = await fetch('/api/whatsapp/templates', { cache: 'no-store' });
      if (tmplRes.ok) {
        const tmplData = await tmplRes.json();
        if (tmplData.templates && Array.isArray(tmplData.templates)) {
          const newMap = { ...templates };
          tmplData.templates.forEach((t: WhatsAppTemplateRecord) => {
            if (t.template_type && t.message_text) {
              newMap[t.template_type] = t.message_text;
            }
          });
          setTemplates(newMap);
        }
      }

      const logsRes = await fetch('/api/whatsapp/logs', { cache: 'no-store' });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCurrentTemplate = async () => {
    setIsSaving(true);
    try {
      const textToSave = templates[activeTab];
      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_type: activeTab,
          message_text: textToSave,
          updated_by: currentUser.name || 'Admin',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Failed to save template to Supabase', 'error');
      } else {
        const label = TEMPLATE_CONFIG.find((t) => t.type === activeTab)?.label || 'Template';
        showToast(label + ' updated successfully!');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving template', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (varName: string) => {
    const current = templates[activeTab] || '';
    const updated = current + ' {{' + varName + '}}';
    setTemplates({ ...templates, [activeTab]: updated });
  };

  const activeTemplateConfig = TEMPLATE_CONFIG.find((t) => t.type === activeTab) || TEMPLATE_CONFIG[0];
  const currentText = templates[activeTab] || '';
  const renderedPreview = substituteTemplateVariables(currentText, SAMPLE_LEAD);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-teal-500 selection:text-slate-950">
      <Navbar userRole="admin" userName={currentUser.name} />

      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-200 ${
            toastMsg.type === 'success' ? 'bg-teal-500 text-slate-950' : 'bg-rose-500 text-white'
          }`}
        >
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <MessageSquare className="w-6 h-6" />
              </div>
              <span>WhatsApp Templates (AiSensy Engine)</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure the 3 1-tap message templates dispatched by callers from the dialer.
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center space-x-3">
            <button
              onClick={loadTemplatesAndLogs}
              disabled={isLoading}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleSaveCurrentTemplate}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition shadow shadow-teal-950/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving to Supabase...' : 'Save Template'}</span>
            </button>
          </div>
        </div>

        {/* 3 TEMPLATE TABS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
          {TEMPLATE_CONFIG.map((t) => {
            const Icon = t.icon;
            const isSelected = activeTab === t.type;

            return (
              <button
                key={t.type}
                type="button"
                onClick={() => setActiveTab(t.type)}
                className={`p-4 rounded-2xl border text-left transition flex items-start space-x-3.5 ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500 text-emerald-300 shadow-xl ring-1 ring-emerald-500/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{t.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* MAIN EDITOR & LIVE PREVIEW TWO-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Left Column: Template Text Editor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-white text-sm">Template Editor ({activeTemplateConfig.label})</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">{currentText.length} characters</span>
            </div>

            {/* Variable insertion buttons */}
            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Click to Insert Variable:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['name', 'phone', 'city', 'form_id', 'campaign'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/50 text-teal-300 font-mono text-xs rounded-lg transition"
                  >
                    {'{{' + v + '}}'}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                rows={7}
                value={currentText}
                onChange={(e) => setTemplates({ ...templates, [activeTab]: e.target.value })}
                placeholder="Enter WhatsApp message text with {{variable}} placeholders..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-white focus:outline-none focus:border-teal-500 leading-relaxed resize-none shadow-inner"
              />
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-start space-x-2 text-xs text-slate-400">
              <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                Variables like <code className="text-teal-300 font-mono">{'{{name}}'}</code>,{' '}
                <code className="text-teal-300 font-mono">{'{{city}}'}</code>, and{' '}
                <code className="text-teal-300 font-mono">{'{{form_id}}'}</code> are automatically replaced with lead data before sending.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveCurrentTemplate}
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition shadow"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {/* Right Column: WhatsApp Speech Bubble Live Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm">Live WhatsApp Message Preview</h3>
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Customer View
                </span>
              </div>

              {/* Sample Data Info */}
              <div className="mt-4 p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-xs space-y-1 font-mono text-slate-400">
                <div className="text-[10px] uppercase font-bold text-slate-500">Sample Lead Data Injected:</div>
                <div className="flex justify-between">
                  <span>Name: <strong className="text-slate-200">{SAMPLE_LEAD.name}</strong></span>
                  <span>City: <strong className="text-slate-200">{SAMPLE_LEAD.city}</strong></span>
                </div>
                <div className="flex justify-between">
                  <span>Phone: <strong className="text-slate-200">{SAMPLE_LEAD.phone}</strong></span>
                  <span>Form ID: <strong className="text-slate-200">{SAMPLE_LEAD.form_id}</strong></span>
                </div>
              </div>

              {/* WhatsApp Chat Bubble Mockup */}
              <div className="mt-5 p-5 bg-[#0b141a] border border-slate-800 rounded-2xl relative overflow-hidden shadow-inner">
                <div className="text-[10px] text-center text-slate-400 mb-3 uppercase tracking-wider font-mono">
                  Today - Hommed Diagnostics
                </div>

                <div className="max-w-md ml-auto bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none shadow-md text-xs leading-relaxed space-y-2">
                  <p className="whitespace-pre-wrap">{renderedPreview || 'Template text is empty...'}</p>
                  <div className="text-right text-[10px] text-emerald-200/70 font-mono flex items-center justify-end space-x-1">
                    <span>10:30 AM</span>
                    <span>Delivered</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-slate-500 text-center font-mono">
              AiSensy API Endpoint: <code className="text-slate-400">https://backend.aisensy.com/campaign/t1/api/v2</code>
            </div>
          </div>

        </div>

        {/* RECENT WHATSAPP DISPATCH LOGS */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-teal-400" />
              <h2 className="font-bold text-white text-base">Recent WhatsApp Dispatch Logs</h2>
            </div>
            <span className="text-xs font-mono text-slate-400">{logs.length} logged dispatches</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No WhatsApp messages logged yet. When callers tap any WhatsApp button in the dialer, records will appear here in real-time.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="pb-3 font-semibold">Timestamp</th>
                    <th className="pb-3 font-semibold">Template</th>
                    <th className="pb-3 font-semibold">Lead ID / Destination</th>
                    <th className="pb-3 font-semibold">Message Preview</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-950/40 transition">
                      <td className="py-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - {' '}
                        {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 capitalize font-bold text-teal-300 whitespace-nowrap">
                        {log.template_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 text-slate-300 whitespace-nowrap">
                        {log.lead_id ? log.lead_id.slice(0, 12) : 'Lead'}
                      </td>
                      <td className="py-3 text-slate-400 max-w-xs truncate" title={log.final_message_sent}>
                        {log.final_message_sent}
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.status === 'sent'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
