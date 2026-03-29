# Product Requirements Document (PRD): NexusGuard

## 1. Product Overview
NexusGuard is a hybrid platform featuring a Programmatic SEO directory and a freemium SaaS dashboard. 
* [cite_start]**The Goal:** Help e-commerce sellers track their economic nexus thresholds across all 50 U.S. states[cite: 51].
* [cite_start]**The Problem:** Since the South Dakota v. Wayfair decision, remote sellers must collect tax once they exceed state-specific thresholds (e.g., $100,000 in sales or 200 transactions)[cite: 54]. [cite_start]Current solutions like Shopify Tax only track native sales, ignoring Amazon or Etsy[cite: 82]. 
* [cite_start]**The Solution:** An SEO directory with 400+ pages detailing specific state rules [cite: 71][cite_start], plus a dashboard that aggregates cross-platform sales to alert users when they hit 80% and 100% of a state's threshold[cite: 75, 76].

## 2. Tech Stack
* **Framework:** Next.js (App Router)
* **Styling:** Tailwind CSS + shadcn/ui (for fast, accessible components)
* **Database & Auth:** Supabase (PostgreSQL)
* **Payments:** Stripe (Checkout and Webhooks)
* **Integrations:** Dummy/Mock API services for initial Shopify/Amazon data (to be replaced by live OAuth later).

## 3. Core Database Schema (Supabase)
We need three primary tables to start:
1. `StateRules`: ID, StateName, Slug, DollarThreshold, TransactionThreshold, EffectiveDate, FilingFrequency, GovPortalLink.
2. `Users`: ID, Email, StripeCustomerId, SubscriptionStatus (free vs. pro).
3. `UserSalesStateMap`: ID, UserID, StateName, TotalSalesAmount, TotalTransactionCount, LastUpdated.

## 4. Phase 1: Programmatic SEO Directory (The Acquisition Engine)
Build a public-facing directory that programmatically generates SEO pages.
* **Routing:** Create a dynamic route `app/states/[slug]/page.tsx`.
* **Data Fetching:** Pull from the `StateRules` table.
* **UI Structure:** Each state page should clearly display:
  * [cite_start]The exact dollar and transaction threshold[cite: 72].
  * [cite_start]Filing frequency (monthly, quarterly, annually)[cite: 72].
  * A call-to-action (CTA) to "Track your progress for free" linking to the SaaS signup.

## 5. Phase 2: The SaaS Dashboard (The Product)
Build the protected user area where sellers track their compliance.
* **Auth:** Set up Supabase authentication (Email/Password or Magic Link).
* **The Dashboard UI:**
  * Render a list or grid of U.S. states.
  * [cite_start]For each state, display two progress bars based on the `UserSalesStateMap` table: one for the Dollar Threshold and one for the Transaction Threshold[cite: 75].
  * **Alert Logic:** If progress > 80%, color the bar yellow. [cite_start]If progress >= 100%, color the bar red and show a "Registration Guide" button[cite: 76].
* **Monetization (Stripe):** * Free Tier: View progress for the top 3 states.
  * [cite_start]Pro Tier ($15/month): View multi-platform aggregated progress for all 50 states[cite: 78].
  * Create a Stripe checkout session route and a webhook handler to update the user's `SubscriptionStatus`.

## 6. Execution Instructions for AI Agent
Read this document thoroughly. We will build this iteratively. 
**DO NOT build everything at once.** Start by scaffolding the Next.js project, setting up Tailwind and shadcn/ui, and building the static UI for the landing page and the `app/states/[slug]/page.tsx` dynamic route using mock data.