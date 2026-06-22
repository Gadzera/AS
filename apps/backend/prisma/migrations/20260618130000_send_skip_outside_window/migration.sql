-- M11-6: причина пропуска отправки «вне окна отправки» (sendWindow/sendDays орг-таймзоны).
ALTER TYPE "SendSkipReason" ADD VALUE IF NOT EXISTS 'OUTSIDE_WINDOW';
