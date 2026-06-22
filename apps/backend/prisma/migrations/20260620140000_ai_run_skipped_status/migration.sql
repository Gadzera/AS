-- M25-2: статус auto-rerun, пропущенного из-за нехватки кредитов (без provider call/debit/retry-loop).
ALTER TYPE "AiRunStatus" ADD VALUE IF NOT EXISTS 'SKIPPED_INSUFFICIENT_CREDITS';
