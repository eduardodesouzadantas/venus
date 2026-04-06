ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'engaged', 'qualified', 'offer_sent', 'closing', 'won', 'lost'));
