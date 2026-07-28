-- The Enterprise plan has been discontinued. It was never purchasable
-- through Stripe checkout (it only linked to a "Contact sales" page), so no
-- legitimate paying customer should be on it — but normalize any row that
-- may have been set to 'enterprise' manually so the app's PlanType union
-- (which no longer includes 'enterprise') stays consistent with the data.
UPDATE public.subscriptions
SET plan = 'team'
WHERE plan = 'enterprise';
