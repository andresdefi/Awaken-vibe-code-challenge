// Canton transaction normalizer for Awaken CSV format

import type { NormalizedTransaction, AwakenTag, TransactionType } from "@/lib/types";
import type { CantonUpdate, CantonEvent } from "./types";
import { CANTON_COIN_SYMBOL, CANTON_COIN_DECIMALS, CANTON_TEMPLATES } from "./types";

// Parse Canton amount (10 decimal places)
function parseCantonAmount(amount: string | undefined): number {
  if (!amount) return 0;
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return parsed;
}

// Format party ID for display (truncate hash)
function formatPartyId(partyId: string): string {
  const parts = partyId.split("::");
  if (parts.length !== 2) return partyId;
  const [hint, hash] = parts;
  return `${hint}::${hash.slice(0, 8)}...`;
}

// Determine transaction type from Canton event
function classifyEvent(
  event: CantonEvent,
  partyId: string
): { type: TransactionType; tag: AwakenTag; isSender: boolean; isReceiver: boolean } {
  const templateId = event.template_id || "";
  const args = event.create_arguments || {};
  const argsStr = JSON.stringify(args).toLowerCase();
  const partyIdLower = partyId.toLowerCase();

  // Check if party is sender or receiver
  const isSender = argsStr.includes(`"sender"`) && argsStr.includes(partyIdLower);
  const isReceiver = argsStr.includes(`"receiver"`) && argsStr.includes(partyIdLower);

  // Classify based on template
  if (templateId.includes("Transfer") || templateId.includes("Amulet")) {
    if (isSender) {
      return { type: "transfer_sent", tag: "payment", isSender: true, isReceiver: false };
    }
    if (isReceiver) {
      return { type: "transfer_received", tag: "receive", isSender: false, isReceiver: true };
    }
  }

  if (templateId.includes("AppRewardCoupon")) {
    return { type: "emission_reward", tag: "claim_rewards", isSender: false, isReceiver: true };
  }

  if (templateId.includes("ValidatorRewardCoupon")) {
    return { type: "emission_reward", tag: "claim_rewards", isSender: false, isReceiver: true };
  }

  if (templateId.includes("SvRewardCoupon")) {
    return { type: "emission_reward", tag: "claim_rewards", isSender: false, isReceiver: true };
  }

  if (templateId.includes("ValidatorFaucetCoupon")) {
    return { type: "emission_reward", tag: "claim_rewards", isSender: false, isReceiver: true };
  }

  if (templateId.includes("LockedAmulet")) {
    return { type: "stake", tag: "staking_deposit", isSender: true, isReceiver: false };
  }

  // Default: treat as transfer
  return { type: "transfer_received", tag: "receive", isSender: false, isReceiver: true };
}

// Extract transfer amounts from event
function extractTransferAmounts(
  event: CantonEvent,
  partyId: string
): { sent: number; received: number; fee: number } {
  const args = event.create_arguments || {};
  const result = { sent: 0, received: 0, fee: 0 };

  // Try to extract amounts from create_arguments
  const argsStr = JSON.stringify(args);
  const partyIdLower = partyId.toLowerCase();

  // Look for amount patterns in the arguments
  try {
    // Check for sender info
    if (args.sender && typeof args.sender === "object") {
      const sender = args.sender as Record<string, unknown>;
      if (String(sender.party || "").toLowerCase().includes(partyIdLower.split("::")[1] || "never_match")) {
        result.sent = parseCantonAmount(sender.input_amulet_amount as string);
        result.fee = parseCantonAmount(sender.sender_fee as string);
      }
    }

    // Check for receivers array
    if (Array.isArray(args.receivers)) {
      for (const receiver of args.receivers) {
        if (typeof receiver === "object" && receiver !== null) {
          const rec = receiver as Record<string, unknown>;
          if (String(rec.party || "").toLowerCase().includes(partyIdLower.split("::")[1] || "never_match")) {
            result.received = parseCantonAmount(rec.amount as string);
            result.fee += parseCantonAmount(rec.receiver_fee as string);
          }
        }
      }
    }

    // Check for balance_changes
    if (Array.isArray(args.balance_changes)) {
      for (const change of args.balance_changes) {
        if (typeof change === "object" && change !== null) {
          const ch = change as Record<string, unknown>;
          if (String(ch.party || "").toLowerCase().includes(partyIdLower.split("::")[1] || "never_match")) {
            const changeAmount = parseCantonAmount(ch.change_to_initial_amount_as_of_round_zero as string);
            if (changeAmount > 0) {
              result.received = changeAmount;
            } else if (changeAmount < 0) {
              result.sent = Math.abs(changeAmount);
            }
          }
        }
      }
    }

    // Check for reward amounts
    if (args.amount) {
      result.received = parseCantonAmount(args.amount as string);
    }
    if (args.initial_amount) {
      result.received = parseCantonAmount(args.initial_amount as string);
    }
  } catch {
    // If parsing fails, return zeros
  }

  return result;
}

// Normalize a Canton update to transactions
export function normalizeCantonUpdate(
  update: CantonUpdate,
  partyId: string
): NormalizedTransaction[] {
  const transactions: NormalizedTransaction[] = [];
  const processedEvents = new Set<string>();

  // Process each event
  for (const [eventId, event] of Object.entries(update.events_by_id)) {
    if (processedEvents.has(eventId)) continue;

    // Only process created events (exercised events are actions on existing contracts)
    if (event.event_type !== "created_event") continue;

    // Check if this event involves our party
    const argsStr = JSON.stringify(event.create_arguments || {}).toLowerCase();
    const partyIdLower = partyId.toLowerCase();

    if (!argsStr.includes(partyIdLower.split("::")[1] || "never_match")) {
      continue;
    }

    processedEvents.add(eventId);

    const classification = classifyEvent(event, partyId);
    const amounts = extractTransferAmounts(event, partyId);

    // Build notes from event details
    const templateParts = (event.template_id || "").split(":");
    const templateName = templateParts[templateParts.length - 1] || "Transaction";

    let notes = templateName;
    if (event.create_arguments?.description) {
      notes = `${templateName}: ${event.create_arguments.description}`;
    }

    const tx: NormalizedTransaction = {
      id: `${update.update_id}-${eventId}`,
      type: classification.type,
      timestamp: new Date(update.effective_at || update.record_time),
      sentAmount: amounts.sent > 0 ? amounts.sent : null,
      sentCurrency: amounts.sent > 0 ? CANTON_COIN_SYMBOL : null,
      receivedAmount: amounts.received > 0 ? amounts.received : null,
      receivedCurrency: amounts.received > 0 ? CANTON_COIN_SYMBOL : null,
      feeAmount: amounts.fee,
      feeCurrency: CANTON_COIN_SYMBOL,
      transactionHash: update.update_id,
      notes: notes,
      tag: classification.tag,
    };

    // Only add if there's actual value
    if (tx.sentAmount || tx.receivedAmount) {
      transactions.push(tx);
    }
  }

  return transactions;
}

// Normalize all updates for a party
export function normalizeCantonUpdates(
  updates: CantonUpdate[],
  partyId: string
): NormalizedTransaction[] {
  const allTransactions: NormalizedTransaction[] = [];

  for (const update of updates) {
    const txs = normalizeCantonUpdate(update, partyId);
    allTransactions.push(...txs);
  }

  // Sort by timestamp descending (newest first)
  allTransactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Deduplicate by ID
  const seen = new Set<string>();
  const deduped = allTransactions.filter((tx) => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });

  return deduped;
}

// Calculate summary statistics
export interface CantonSummary {
  totalTransactions: number;
  transfers: number;
  rewards: number;
  fees: number;
  totalSent: number;
  totalReceived: number;
  totalFees: number;
}

export function calculateSummary(transactions: NormalizedTransaction[]): CantonSummary {
  const summary: CantonSummary = {
    totalTransactions: transactions.length,
    transfers: 0,
    rewards: 0,
    fees: 0,
    totalSent: 0,
    totalReceived: 0,
    totalFees: 0,
  };

  for (const tx of transactions) {
    if (tx.sentAmount) summary.totalSent += tx.sentAmount;
    if (tx.receivedAmount) summary.totalReceived += tx.receivedAmount;
    summary.totalFees += tx.feeAmount;

    switch (tx.type) {
      case "transfer_sent":
      case "transfer_received":
        summary.transfers++;
        break;
      case "emission_reward":
        summary.rewards++;
        break;
      default:
        summary.fees++;
    }
  }

  return summary;
}
