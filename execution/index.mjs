import { generateEmail } from './emailGenerator.mjs';
import { canSendEmail, sendEmail } from './emailSender.mjs';
import { generateLinkedInDm } from './linkedinGenerator.mjs';

function firstDefined(...values) {
  return values.find((value) => typeof value === 'string' && value.trim());
}

export function resolveEmailRecipient(opportunity = {}) {
  return firstDefined(
    opportunity.contactEmail,
    opportunity.email,
    opportunity.contact?.email,
    opportunity.metadata?.contact_email,
    opportunity.metadata?.email,
  ) ?? null;
}

export function resolveLinkedInProfile(opportunity = {}) {
  return firstDefined(
    opportunity.linkedinUrl,
    opportunity.contact?.linkedin,
    opportunity.metadata?.linkedin_url,
    opportunity.metadata?.linkedin,
  ) ?? null;
}

export function simulateExecution(action, randomValue = Math.random()) {
  const outcomes = {
    outreach: ['replied', 'meeting', 'rejected'],
    research: ['qualified', 'discarded'],
    deep_followup: ['meeting', 'converted', 'rejected'],
    ignore: ['rejected'],
  };

  const options = outcomes[action] || ['rejected'];
  const index = Math.max(0, Math.min(options.length - 1, Math.floor(randomValue * options.length)));
  return options[index];
}

export async function executeAction({
  action,
  opportunity,
  positioning,
  outreach = {},
}) {
  if (action === 'ignore') {
    return {
      status: 'discarded',
      channel: 'none',
      mode: 'skipped',
      details: 'Opportunity intentionally ignored.',
    };
  }

  if (action === 'research') {
    return {
      status: 'qualified',
      channel: 'research',
      mode: 'completed',
      details: 'Opportunity advanced for additional qualification.',
    };
  }

  const email = await generateEmail(opportunity, positioning, outreach);
  const linkedin = await generateLinkedInDm(opportunity, positioning, outreach);
  const emailRecipient = resolveEmailRecipient(opportunity);
  const linkedinProfile = resolveLinkedInProfile(opportunity);

  if ((action === 'outreach' || action === 'deep_followup') && emailRecipient && canSendEmail()) {
    try {
      const info = await sendEmail({
        to: emailRecipient,
        subject: email.subject,
        body: email.body,
      });

      return {
        status: 'contacted',
        channel: 'email',
        mode: 'sent',
        recipient: emailRecipient,
        messageId: info?.messageId ?? null,
        email,
        linkedin,
        linkedinProfile,
      };
    } catch (error) {
      console.warn(`[EXECUTION] Email send failed for ${opportunity.label}: ${error.message}`);
      return {
        status: 'outreach_drafted',
        channel: 'email',
        mode: 'draft_only',
        recipient: emailRecipient,
        error: error.message,
        email,
        linkedin,
        linkedinProfile,
      };
    }
  }

  return {
    status: 'outreach_drafted',
    channel: linkedinProfile ? 'linkedin' : 'email',
    mode: 'manual',
    recipient: emailRecipient,
    email,
    linkedin,
    linkedinProfile,
    details: linkedinProfile
      ? 'LinkedIn DM drafted in safe mode for manual sending.'
      : 'Email drafted; configure recipient and SMTP credentials to send automatically.',
  };
}
