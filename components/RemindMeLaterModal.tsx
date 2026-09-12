'use client';

import React, { useState } from 'react';
import { Clock, Calendar, Check, AlertCircle, X, BellRing, Sparkles } from 'lucide-react';
import { Lead, Profile, CallReminder } from '@/lib/types';
import { playNotificationChime } from '@/lib/notifications';

interface RemindMeLaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  currentUser?: Profile;
  onReminderSet?: (reminder: CallReminder) => void;
}

export default function RemindMeLaterModal({
  isOpen,
  onClose,
  lead,
  currentUser,
  onReminderSet,
}: RemindMeLaterModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>('1h');
  const [customDateTime, setCustomDateTime] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const getPresetDateTime = (preset: string): Date => {
    const now = new Date();
    switch (preset) {
      case '30m':
        return new Date(now.getTime() + 30 * 60 * 1000);
      case '1h':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case '2h':
        return new Date(now.getTime() + 2 * 60 * 60 * 1000);
      case '4h':
        return new Date(now.getTime() + 4 * 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() + 6 * 60 * 60 * 1000);
      case 'tomorrow_10am': {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(10, 30, 0, 0);
        return d;
      }
      case 'tomorrow_2pm': {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(14, 30, 0, 0);
        return d;
      }
      case 'tomorrow_6pm': {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(18, 0, 0, 0);
        return d;
      }
      default:
        return new Date(now.getTime() + 60 * 60 * 1000);
    }
  };

  const calculateTargetTime = (): Date | null => {
    if (selectedPreset === 'custom') {
      if (!customDateTime) return null;
      const d = new Date(customDateTime);
      return isNaN(d.getTime()) ? null : d;
    }
    if (selectedPreset) {
      return getPresetDateTime(selectedPreset);
    }
    return null;
  };

  const handlePresetClick = (presetKey: string) => {
    setSelectedPreset(presetKey);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetDate = calculateTargetTime();
    if (!targetDate) {
      setErrorMsg('Please select a callback time or enter a custom date & time.');
      return;
    }

    if (targetDate.getTime() <= Date.now()) {
      setErrorMsg('Callback time must be in the future.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        leadId: lead.id,
        callerId: currentUser?.id || null,
        callerName: currentUser?.name || 'Caller',
        leadName: lead.name || 'Lead',
        leadPhone: lead.phone || '',
        remindAt: targetDate.toISOString(),
        bufferMinutes: 15,
        note: note.trim() || undefined,
      };

      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save reminder');
      }

      playNotificationChime();

      if (onReminderSet && data.reminder) {
        onReminderSet(data.reminder);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating reminder');
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetDate = calculateTargetTime();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>Remind Me Later / Callback Schedule</span>
              </h2>
              <p className="text-xs text-slate-400">
                Patient: <span className="text-teal-300 font-semibold">{lead.name}</span> ({lead.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Quick Timing Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '30m', label: '+30 Min' },
                { id: '1h', label: '+1 Hour' },
                { id: '2h', label: '+2 Hours' },
                { id: '4h', label: '+4 Hours' },
                { id: '6h', label: '+6 Hours' },
                { id: 'tomorrow_10am', label: 'Tomorrow 10:30 AM' },
                { id: 'tomorrow_2pm', label: 'Tomorrow 2:30 PM' },
                { id: 'tomorrow_6pm', label: 'Tomorrow 6:00 PM' },
                { id: 'custom', label: 'Exact Date/Time...' },
              ].map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition border text-center ${
                      isSelected
                        ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-lg scale-[1.02]'
                        : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Time Picker (if selected) */}
          {selectedPreset === 'custom' && (
            <div className="p-3 bg-slate-950 border border-teal-500/40 rounded-2xl space-y-2 animate-in fade-in duration-150">
              <label className="text-xs font-semibold text-teal-300 flex items-center space-x-1.5">
                <Calendar className="w-4 h-4" />
                <span>Select Exact Date & Time:</span>
              </label>
              <input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
                min={new Date().toISOString().slice(0, 16)}
                required
              />
            </div>
          )}

          {/* Scheduled Summary Pill */}
          {targetDate && (
            <div className="p-3 bg-teal-950/40 border border-teal-500/30 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <BellRing className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="text-slate-300 font-medium">Callback scheduled for:</span>
              </div>
              <span className="text-teal-300 font-mono font-bold">
                {targetDate.toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {/* Optional Short Note */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Callback Reason / Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "Asked to call after lunch", "Driving right now"'
              maxLength={150}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              A reminder notification will trigger automatically 15 minutes before the requested time.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-lg hover:scale-[1.02] active:scale-95"
            >
              {isSubmitting ? (
                <span>Setting Reminder...</span>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Set Reminder</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
