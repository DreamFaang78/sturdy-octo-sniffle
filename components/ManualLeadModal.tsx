'use client';

import React, { useState } from 'react';
import { X, UserPlus, Phone, User, Tag, FileText } from 'lucide-react';
import { Lead } from '@/lib/types';

interface ManualLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded: (lead: Lead) => void;
}

export default function ManualLeadModal({ isOpen, onClose, onLeadAdded }: ManualLeadModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('Manual Entry');
  const [campaign, setCampaign] = useState('Direct Inbound / Referral');
  const [packageType, setPackageType] = useState('Full Body Health Checkup');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    setLoading(true);

    const newLeadData = {
      name,
      phone: phone.startsWith('+91') ? phone : `+91${phone.replace(/[^0-9]/g, '')}`,
      source,
      campaign,
      form_answers: {
        'Package / Service': packageType,
        'City / Location': city || 'Not specified',
        'Initial Note': notes,
      },
      status: 'unassigned'
    };

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLeadData),
      });

      if (!response.ok) {
        throw new Error('Failed to create lead');
      }

      const savedLead = await response.json();

      onLeadAdded(savedLead);
      setName('');
      setPhone('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Error adding manual lead:', error);
      alert('Failed to add lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Add New Lead</h3>
              <p className="text-xs text-slate-400">Add inbound customer for CRM assignment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Patient / Lead Name *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number (WhatsApp) *</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              >
                <option value="Manual Entry">Manual Entry</option>
                <option value="Facebook Ads">Facebook Ads</option>
                <option value="Instagram Ads">Instagram Ads</option>
                <option value="WhatsApp Direct">WhatsApp Direct</option>
                <option value="Referral">Patient Referral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">City / Location</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Delhi NCR"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Interested Health Package</label>
            <select
              value={packageType}
              onChange={(e) => setPackageType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
            >
              <option value="Full Body Health Checkup">Full Body Health Checkup</option>
              <option value="Diabetes Care Package">Diabetes Care Package</option>
              <option value="Senior Citizen Health Care">Senior Citizen Health Care</option>
              <option value="Home Physiotherapy">Home Physiotherapy</option>
              <option value="Thyroid & Lipid Care">Thyroid & Lipid Care</option>
              <option value="Other Diagnostics">Other Diagnostics</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Initial Caller Note</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Interested in booking for tomorrow morning..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-semibold rounded-lg transition shadow"
            >
              {loading ? 'Adding...' : 'Add Lead to Unassigned'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
