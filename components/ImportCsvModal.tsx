'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { Lead } from '@/lib/types';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsImported: () => void;
}

export default function ImportCsvModal({ isOpen, onClose, onLeadsImported }: ImportCsvModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

      if (lines.length < 2) {
        throw new Error('CSV file is empty or missing headers.');
      }

      // Parse headers
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      
      const nameIndex = headers.findIndex((h) => h.includes('full_name') || h.includes('name') || h.includes('first_name'));
      const phoneIndex = headers.findIndex((h) => h.includes('phone_number') || h.includes('phone_num') || h.includes('phone') || h.includes('mobile'));
      const campaignIndex = headers.findIndex((h) => h.includes('campaign') || h.includes('form_name') || h.includes('ad_name'));
      const timeIndex = headers.findIndex((h) => h.includes('created_time') || h.includes('date'));

      const parsedLeads: Partial<Lead>[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Parse CSV row respecting quotes
        const row = lines[i];
        const cells: string[] = [];
        let inQuotes = false;
        let currentCell = '';

        for (let j = 0; j < row.length; j++) {
          const char = row[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cells.push(currentCell.trim().replace(/^["']|["']$/g, ''));
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        cells.push(currentCell.trim().replace(/^["']|["']$/g, ''));

        const rawName = nameIndex !== -1 ? cells[nameIndex] : '';
        const rawPhone = phoneIndex !== -1 ? cells[phoneIndex] : '';
        const rawCampaign = campaignIndex !== -1 ? cells[campaignIndex] : 'Facebook Lead Ads';
        const rawTime = timeIndex !== -1 ? cells[timeIndex] : new Date().toISOString();

        if (rawPhone && rawPhone.trim() !== '') {
          let cleanPhone = rawPhone.replace(/[^\d+]/g, '');
          if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
            cleanPhone = '+91' + cleanPhone;
          }

          parsedLeads.push({
            name: rawName || 'Facebook Lead',
            phone: cleanPhone,
            campaign: rawCampaign || 'Facebook Lead Ads',
            source: 'Facebook Lead Ads (CSV Import)',
            status: 'unassigned',
            created_at: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(),
          });
        }
      }

      if (parsedLeads.length === 0) {
        throw new Error('No valid leads with phone numbers found in this CSV.');
      }

      // Send to backend batch insertion API
      const res = await fetch('/api/leads/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: parsedLeads }),
      });

      const resJson = await res.json();

      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to import leads.');
      }

      setSuccessMsg(`Successfully imported ${resJson.importedCount || parsedLeads.length} leads!`);
      onLeadsImported();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing CSV file.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Import Facebook Leads CSV</h3>
              <p className="text-xs text-slate-400">Upload an exported CSV from Meta Ads Manager / Instant Forms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-teal-500/60 bg-slate-950/50 hover:bg-teal-500/5 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition text-center group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {isUploading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                <span className="text-xs text-slate-300 font-semibold">Importing leads into database...</span>
              </div>
            ) : (
              <>
                <FileText className="w-10 h-10 text-slate-500 group-hover:text-teal-400 transition mb-3" />
                <span className="text-sm font-semibold text-slate-200 group-hover:text-white">
                  Click to select Facebook Leads CSV
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Supports standard Meta Leads exports (includes full_name, phone_number, campaign)
                </span>
              </>
            )}
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-300">How to export past leads from Facebook:</div>
            <div className="text-[11px] leading-relaxed">
              1. Go to <strong>Meta Ads Manager</strong> or <strong>Business Suite</strong> ? <strong>Instant Forms</strong>.<br />
              2. Next to your form (e.g. <em>Sept-1</em>), click <strong>"Download"</strong>.<br />
              3. Select <strong>"Download new leads"</strong> or choose <strong>date range (Yesterday to Present)</strong> ? select <strong>CSV</strong>.<br />
              4. Upload the downloaded CSV here to instantly import all leads.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
