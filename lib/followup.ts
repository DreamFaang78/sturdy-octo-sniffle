import { LeadStatus } from './types';

export interface FollowUpCalculation {
  next_follow_up_date: string | null; // YYYY-MM-DD
  follow_up_stage: number;
  is_cold: boolean;
  phone_attempt_count_increment?: boolean;
}

export function calculateFollowUpSchedule(
  currentStatus: LeadStatus,
  currentStage: number = 0,
  currentAttempts: number = 0
): FollowUpCalculation {
  const today = new Date();
  
  if (currentStatus === 'phone_not_picked') {
    // Phone Not Picked -> Remind caller next day
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return {
      next_follow_up_date: tomorrow.toISOString().split('T')[0],
      follow_up_stage: currentStage,
      is_cold: false,
      phone_attempt_count_increment: true,
    };
  }

  if (currentStatus === 'qualified') {
    // 7-day Follow-up Cadence: Day 1, Day 3, Day 5, Day 7
    let daysToAdd = 1;
    let nextStage = currentStage + 1;
    let cold = false;

    if (currentStage === 0 || currentStage === 1) {
      daysToAdd = 1; // Day 1
      nextStage = 1;
    } else if (currentStage === 2) {
      daysToAdd = 2; // Day 3 total (+2 days from Day 1)
      nextStage = 2;
    } else if (currentStage === 3) {
      daysToAdd = 2; // Day 5 total (+2 days from Day 3)
      nextStage = 3;
    } else if (currentStage === 4) {
      daysToAdd = 2; // Day 7 total (+2 days from Day 5)
      nextStage = 4;
    } else {
      // After Day 7 -> Cold bucket
      cold = true;
      return {
        next_follow_up_date: null,
        follow_up_stage: 5,
        is_cold: true,
      };
    }

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysToAdd);

    return {
      next_follow_up_date: nextDate.toISOString().split('T')[0],
      follow_up_stage: nextStage,
      is_cold: cold,
    };
  }

  // Converted, Useless, or Unassigned -> clear follow-up date
  return {
    next_follow_up_date: null,
    follow_up_stage: 0,
    is_cold: false,
  };
}
