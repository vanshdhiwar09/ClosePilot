// src/agent/tools.ts
// Read-only investigation tools for ClosePilot Autonomous Investigation Agent.
// Strictly non-mutating: provides grounded observation without modifying financial state.

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument } from "../schemas/supporting-document";
import { ReconcileTransactionOutput } from "../reconciliation/pipeline";
import { HumanReviewSession } from "../review/state-machine";
import { CaseDetail, ToolCallRecord } from "./types";
import { HumanReviewDecision } from "../review/types";
import { normalizeVendor, normalizeReference } from "../reconciliation/normalize";
import { calculateDateDifferenceDays } from "../reconciliation/date";
import { compareMoney, absDifferenceMoney } from "../utils/money";

export type InvestigationContext = {
  bankTransactions: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  documents: SupportingDocument[];
  reconcileOutputs: Map<string, ReconcileTransactionOutput>;
  caseBankTxMap?: Map<string, string>; // caseId -> bankTxId
  reviewSession?: HumanReviewSession;
};

export class ReadOnlyInvestigationToolbox {
  private readonly toolCalls: ToolCallRecord[] = [];
  private readonly bankTxMap = new Map<string, BankTransaction>();
  private readonly ledgerMap = new Map<string, LedgerEntry>();
  private readonly docMap = new Map<string, SupportingDocument>();

  constructor(private readonly context: InvestigationContext) {
    for (const b of context.bankTransactions) {
      this.bankTxMap.set(b.id, b);
    }
    for (const l of context.ledgerEntries) {
      this.ledgerMap.set(l.id, l);
    }
    for (const d of context.documents) {
      this.docMap.set(d.id, d);
    }
  }

  /**
   * Returns all recorded tool calls for this investigation session.
   */
  public getRecordedToolCalls(): ToolCallRecord[] {
    return [...this.toolCalls];
  }

  /**
   * Helper to record tool invocation and timing.
   */
  private recordCall<T>(toolName: string, input: Record<string, unknown>, fn: () => T): T {
    const start = performance.now();
    try {
      const output = fn();
      const durationMs = performance.now() - start;
      this.toolCalls.push({
        toolName,
        input,
        output,
        timestamp: new Date().toISOString(),
        durationMs,
      });
      return output;
    } catch (err: any) {
      const durationMs = performance.now() - start;
      this.toolCalls.push({
        toolName,
        input,
        output: { error: err.message },
        timestamp: new Date().toISOString(),
        durationMs,
      });
      throw err;
    }
  }

  /**
   * Tool 1: get_case
   * Retrieves complete case context: bank transaction, reconciliation result, exceptions,
   * candidate ledger entries, evidence items, rule trace, and human review history.
   */
  public get_case(caseId: string): CaseDetail {
    return this.recordCall("get_case", { caseId }, () => {
      // Resolve bankTransactionId from caseId
      let bankTxId = caseId;
      if (this.context.caseBankTxMap?.has(caseId)) {
        bankTxId = this.context.caseBankTxMap.get(caseId)!;
      }

      const bankTx = this.bankTxMap.get(bankTxId);
      if (!bankTx) {
        throw new Error(`get_case failed: BankTransaction "${bankTxId}" for case "${caseId}" not found.`);
      }

      const output = this.context.reconcileOutputs.get(bankTxId);
      if (!output) {
        throw new Error(`get_case failed: Reconciliation output for transaction "${bankTxId}" not found.`);
      }

      const candidateIds = output.result.candidateLedgerEntryIds || [];
      const candidateLedgerEntries = candidateIds
        .map((id) => this.ledgerMap.get(id))
        .filter((e): e is LedgerEntry => Boolean(e));

      let humanReviewHistory: HumanReviewDecision[] = [];
      if (this.context.reviewSession) {
        try {
          humanReviewHistory = [...this.context.reviewSession.getDecisions(caseId)];
        } catch {
          // Review session may not have this case if auto-resolved
        }
      }

      const ruleTrace = output.matchResult?.ruleTrace || [];

      return {
        caseId,
        bankTransaction: bankTx,
        reconciliationResult: output.result,
        candidateLedgerEntries,
        exceptions: output.exceptions,
        evidence: output.evidence,
        ruleTrace,
        autoResolutionAllowed: output.autoResolutionAllowed,
        humanReviewHistory,
      };
    });
  }

  /**
   * Tool 2: get_evidence
   * Retrieves evidence associated with a case. Validates requested references explicitly.
   */
  public get_evidence(caseId: string, requestedEvidenceIds?: string[]) {
    return this.recordCall("get_evidence", { caseId, requestedEvidenceIds }, () => {
      const caseDetail = this.get_case_internal(caseId);
      const availableEvidence = caseDetail.evidence;
      const availableMap = new Map(availableEvidence.map((e) => [e.id, e]));

      if (!requestedEvidenceIds || requestedEvidenceIds.length === 0) {
        return availableEvidence;
      }

      const results = [];
      for (const reqId of requestedEvidenceIds) {
        const item = availableMap.get(reqId);
        if (!item) {
          throw new Error(
            `get_evidence failed: Requested evidence ID "${reqId}" not found for case "${caseId}". Available IDs: [${Array.from(availableMap.keys()).join(", ")}]`
          );
        }
        results.push(item);
      }
      return results;
    });
  }

  /**
   * Tool 3: get_ledger_entry
   * Retrieves a specific ledger entry by ID, including linked supporting documents.
   */
  public get_ledger_entry(ledgerEntryId: string) {
    return this.recordCall("get_ledger_entry", { ledgerEntryId }, () => {
      const entry = this.ledgerMap.get(ledgerEntryId);
      if (!entry) {
        throw new Error(`get_ledger_entry failed: LedgerEntry "${ledgerEntryId}" not found.`);
      }

      const linkedDocuments = (entry.documentIds || [])
        .map((docId) => this.docMap.get(docId))
        .filter((d): d is SupportingDocument => Boolean(d));

      return {
        entry,
        linkedDocuments,
      };
    });
  }

  /**
   * Tool 4: get_related_transactions
   * Searches for relevant ledger entries or bank transactions using existing deterministic
   * normalization and matching principles (account, vendor/reference tokens, date window).
   * Does NOT invent a secondary matching engine.
   */
  public get_related_transactions(
    caseId: string,
    options?: {
      searchByVendor?: boolean;
      searchByAmount?: boolean;
      dateWindowDays?: number;
    }
  ) {
    return this.recordCall("get_related_transactions", { caseId, options }, () => {
      const caseDetail = this.get_case_internal(caseId);
      const tx = caseDetail.bankTransaction;
      const normVendor = normalizeVendor(tx.counterparty || tx.description);
      const normRef = normalizeReference(tx.reference || tx.description);
      const dateWindow = options?.dateWindowDays ?? 30;

      const relatedLedger: Array<{
        entry: LedgerEntry;
        amountDifference: string;
        dateDifferenceDays: number;
        vendorMatch: boolean;
        referenceMatch: boolean;
      }> = [];

      for (const entry of this.context.ledgerEntries) {
        if (entry.accountId !== tx.accountId || entry.currency !== tx.currency) {
          continue;
        }

        const entryAmount = entry.debit !== "0.00" ? entry.debit : entry.credit;
        const entryNormVendor = normalizeVendor(entry.vendor || entry.memo || "");
        const entryNormRef = normalizeReference(entry.reference || entry.memo || "");

        const dateDiff = calculateDateDifferenceDays(tx.transactionDate, entry.entryDate);
        if (dateDiff > dateWindow) {
          continue;
        }

        const vendorMatch = Boolean(normVendor && entryNormVendor && normVendor === entryNormVendor);
        const refMatch = Boolean(normRef && entryNormRef && normRef === entryNormRef);
        const amountDiff = absDifferenceMoney(tx.amount, entryAmount);

        let matchesCriteria = false;
        if (options?.searchByAmount && compareMoney(tx.amount, entryAmount) === 0) {
          matchesCriteria = true;
        }
        if (options?.searchByVendor && (vendorMatch || refMatch)) {
          matchesCriteria = true;
        }
        if (!options?.searchByAmount && !options?.searchByVendor) {
          // Default: match if vendor, reference, or amount align
          matchesCriteria = vendorMatch || refMatch || compareMoney(tx.amount, entryAmount) === 0;
        }

        if (matchesCriteria) {
          relatedLedger.push({
            entry,
            amountDifference: amountDiff,
            dateDifferenceDays: dateDiff,
            vendorMatch,
            referenceMatch: refMatch,
          });
        }
      }

      return {
        bankTransactionId: tx.id,
        relatedLedgerCount: relatedLedger.length,
        relatedLedgerEntries: relatedLedger,
      };
    });
  }

  /**
   * Tool 5: get_case_history
   * Retrieves human review decisions and audit trail for this case.
   */
  public get_case_history(caseId: string) {
    return this.recordCall("get_case_history", { caseId }, () => {
      if (!this.context.reviewSession) {
        return [];
      }
      try {
        return [...this.context.reviewSession.getDecisions(caseId)];
      } catch {
        return [];
      }
    });
  }

  /**
   * Internal unrecorded get_case for other tool implementations.
   */
  private get_case_internal(caseId: string): CaseDetail {
    let bankTxId = caseId;
    if (this.context.caseBankTxMap?.has(caseId)) {
      bankTxId = this.context.caseBankTxMap.get(caseId)!;
    }
    const bankTx = this.bankTxMap.get(bankTxId);
    if (!bankTx) {
      throw new Error(`BankTransaction "${bankTxId}" for case "${caseId}" not found.`);
    }
    const output = this.context.reconcileOutputs.get(bankTxId);
    if (!output) {
      throw new Error(`Reconciliation output for transaction "${bankTxId}" not found.`);
    }
    const candidateIds = output.result.candidateLedgerEntryIds || [];
    const candidateLedgerEntries = candidateIds
      .map((id) => this.ledgerMap.get(id))
      .filter((e): e is LedgerEntry => Boolean(e));

    let humanReviewHistory: HumanReviewDecision[] = [];
    if (this.context.reviewSession) {
      try {
        humanReviewHistory = [...this.context.reviewSession.getDecisions(caseId)];
      } catch {
        // no history yet
      }
    }

    return {
      caseId,
      bankTransaction: bankTx,
      reconciliationResult: output.result,
      candidateLedgerEntries,
      exceptions: output.exceptions,
      evidence: output.evidence,
      ruleTrace: output.matchResult?.ruleTrace || [],
      autoResolutionAllowed: output.autoResolutionAllowed,
      humanReviewHistory,
    };
  }
}
