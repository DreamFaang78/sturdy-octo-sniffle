import { Lead, Profile } from './types';

export interface DistributeResult {
  assignedLeads: { leadId: string; callerId: string; assignedAt: string }[];
  updatedLeads: Lead[];
}

export function distributeLeadsEvenly(
  unassignedLeads: Lead[],
  activeCallers: Profile[]
): DistributeResult {
  if (unassignedLeads.length === 0 || activeCallers.length === 0) {
    return { assignedLeads: [], updatedLeads: [] };
  }

  const assignedLeads: { leadId: string; callerId: string; assignedAt: string }[] = [];
  const updatedLeads: Lead[] = [];
  const now = new Date().toISOString();

  unassignedLeads.forEach((lead, index) => {
    const caller = activeCallers[index % activeCallers.length];
    const updatedLead: Lead = {
      ...lead,
      assigned_to: caller.id,
      assigned_at: now,
      assignee: caller,
      status: lead.status || 'unassigned',
      updated_at: now,
    };
    
    assignedLeads.push({
      leadId: lead.id,
      callerId: caller.id,
      assignedAt: now,
    });
    updatedLeads.push(updatedLead);
  });

  return { assignedLeads, updatedLeads };
}
