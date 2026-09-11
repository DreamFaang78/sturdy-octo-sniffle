// Browser Pop-Up & Audio Notification Engine for Hommed Telecallers

export function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve(false);
  }

  if (Notification.permission === 'granted') {
    return Promise.resolve(true);
  }

  if (Notification.permission !== 'denied') {
    return Notification.requestPermission().then((permission) => permission === 'granted');
  }

  return Promise.resolve(false);
}

export function sendBrowserNotification(title: string, body: string, iconUrl?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: iconUrl || '/favicon.ico',
        badge: '/favicon.ico',
        tag: `hommed-notify-${Date.now()}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn('Native notification trigger failed:', e);
    }
  }
}

// Synthesize a soft notification chime using Web Audio API (No external sound files required)
export function playNotificationChime() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Ignore audio context autoplay restrictions gracefully
  }
}

// Helper to format exact follow-up urgency and timing string
export function getFollowUpUrgency(nextDateStr: string | null | undefined, nextTimeStr?: string): {
  label: string;
  urgency: 'overdue' | 'today' | 'upcoming' | 'none';
  badgeColor: string;
} {
  if (!nextDateStr) {
    return { label: 'No Active Follow-up', urgency: 'none', badgeColor: 'bg-slate-800 text-slate-400' };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const timeFormatted = nextTimeStr || '10:30 AM';

  if (nextDateStr < todayStr) {
    return {
      label: `OVERDUE (Scheduled ${nextDateStr} at ${timeFormatted})`,
      urgency: 'overdue',
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-extrabold shadow-sm',
    };
  }

  if (nextDateStr === todayStr) {
    return {
      label: `DUE TODAY at ${timeFormatted}`,
      urgency: 'today',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse',
    };
  }

  return {
    label: `Scheduled for ${nextDateStr} at ${timeFormatted}`,
    urgency: 'upcoming',
    badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium',
  };
}
