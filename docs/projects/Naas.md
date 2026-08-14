---
title: Network automation platform
description: A self-service network automation platform built at work — DNS, firewall rules, load-balancer onboarding, and an LLM-powered agent, using Django.
tags: [Django, DRF, Python, Anthropic, LangGraph, Network Automation, REST API, PostgreSQL]
---

# NAAS

NAAS stands for **Network as a Service**. The whole point is this: a developer who wants a DNS record, a firewall rule, or an IP added to an allow-list shouldn't have to raise a ticket and wait two days. They hit an API, they get what they need, the network team stops doing the mundane bit.

This isn't a weekend project — it's the thing I actually get paid to do, so there's no public repo to link, and I'll keep vendor names out of it. The shape of the problem is what matters. I'm writing about it because it's the first thing I built from scratch (with some guidance ofc) that runs in prod, serves real users, and gets used every day.

## What it looks like underneath

A Django + DRF service. It started life in Flask and migrated to Django once the internal devops community (which I was part of) decided to build an internal Backstage IDP, hosting all infra services in one place — so we rewired the entire project in Django. And the ORM, god is that good, I think I've forgotten SQL completely now. The admin panel — one more reason to forget SQL. The migrations story, all of it. Functionally it's an API gateway sitting in front of a handful of vendors: an internal DNS appliance, a public DNS provider, a load balancer, a frontend firewall, actual firewalls for ACLs, and the L2/L3 switching fabric.

A few things show up in every module and are worth pulling out before the modules themselves:

- **Auth.** NAAS uses the original AuthCentre — the v1 sitting in production here ([v2](AuthcentreV2.md) is the weekend rewrite). It accepts basic auth, validates against AD, and pulls back the user's resource groups. Each endpoint declares the `(service, role)` pair it needs and the middleware rejects anything that doesn't have it.
- **Logs and notifications.** Two destinations on every action — the central log aggregator for forensics, and an internal chat channel plus an email DL for live awareness. The team sees DNS records being created and firewall changes scrolling past in real time.
- **Postgres + the Django admin.** The DB started as SQLite and then postgres. The admin panel doubles for DB access is handy.

## DNS

The busiest module by a wide margin. Most of the traffic flowing through the gateway is DNS — somebody wants an A record for a new service, a CNAME for a vanity URL, a TXT record — all of it. Especially the decomm jobs, dozens of tickets each day. Doing it ticket-driven was painful, hence this.

The module exposes a single REST surface that covers A, Host, CNAME, PTR, TXT — plus bulk operations for environment bootstrap. Calls fan out to a fairly standard enterprise DNS appliance underneath.

The two design choices that earned their keep:

- **Automatic view routing.** Enterprise DNS appliances let the same hostname resolve to different IPs depending on whether the query came from inside or outside the network. NAAS reads a config file and routes each request to the correct view based on the domain. Without that, callers had to pick the view themselves and got it wrong — automating it killed a whole class of "why isn't my record resolving" tickets.
- **Verify after write.** Every successful create is followed by a lookup to confirm the record actually resolves.

Bulk is non-atomic by design — there's no transactional API to roll back partial failures, so each record is attempted independently and the response is a per-entry result list. Worse than atomic, much better than nothing, and the right trade-off when the use case is bootstrapping dozens of records. Bulk was for niche workflows, especially the decomm one — that whole queue is off my plate now, fully automated, much better.

Same period in 2025: ~150 DNS requests at 2.5 days average delivery. Last month: 320 changes, all automated, all under five seconds. 99.998% off delivery time.

## Client onboarding

Client onboarding is the workflow that gets a client's source IPs onto an allow-list on the frontend firewall. Although simple, the device in scope was risky, hence the full ITSM workflow — requests, approvals, changes, change windows, and so on.

So it's a **three-phase async pipeline**:

1. **Intake (synchronous).** Validates the IPs against a list of blocked ranges, checks if they're already on the relevant address list, and raises a ticket on the requester's behalf if everything looks fine. Returns in under a second.
2. **Approval poll (background, every 5 min).** Watches the ticketing system for approvals, finds the next available maintenance window of the right length, and opens a scheduled change linked to the original ticket.
3. **Implementation (background, every 5 min).** Snapshot before, HA sync verify, apply the change to the active box across both prod and demo environments, verify sync didn't break, snapshot after, generate a diff URL, close the ticket.

If anything fails, the pipeline raises an incident, leaves the change in a clean `Failed` state, and stops. It deliberately does not try to "fix it up" automatically — that's how you get paged at 4 a.m. One flex: it hasn't failed in the workflow since prod deployment.

Two flavours of distributed locking keep the workers honest: per-ticket advisory locks in Phase 2 so workers can process tickets in parallel without colliding, and a single global lock in Phase 3 so only one worker touches the load balancer at any moment.

Volume looks identical — three FIX onboardings same period last year, three last month — but the clock moved: 1.9 days average then, ~5 hours now. 89% off delivery time.

## Firewall (rule automation)

The most involved module in the platform by quite a stretch. Client onboarding is allow-listing on a box that already knows about the destination. This module creates *new firewall rules* on the edge firewalls — a real policy change on a real firewall, with real consequences if it's wrong.

Phase 1 is synchronous from the caller's point of view, then hands off to a background thread for the heavy lifting. It does most of the thinking:

- **Deduplicate.** One thing I learnt from a previous project: keep APIs granular. That earlier project processed everything synchronously — the client waiting on the connection for a minute or so — bad. So the redesign splits submission from processing, and folds in idempotency as a side effect — dedupe against in-flight requests with the same intent so a frontend retry or two engineers asking for the same rule don't produce two tickets.
- **Resolve** every source and destination to IPs and classify them against the org's network topology.
- **Policy-grid check.** A persistent matrix of allowed source-group → destination-group combinations. Requests that can't possibly be approved by policy get rejected early with a clear reason — better than burning two days of security review on a request that was always going to be denied.
- **Path-analysis check, per flow.** For every `(src, dst, port, protocol)` combination, ask the network analysis platform what would happen today. Already-permitted flows drop out silently — no rule needed. Actively-denied flows are the ones we'll write a rule for. Errored flows park the request in a `NeedsReview` state for the network team to disposition manually.
- **CMDB lookup.** Each IP resolves back to its owning application. The app name becomes the address-group name on the firewall — rules reference named groups, not raw IPs, so future host changes don't mean editing the rule.
- **Plan build.** Decide *where* and *how* the rule should land on each affected firewall — the placement strategy below is the engineering bit I'm most pleased with.
- **Raise the ticket.** Justification, affected firewalls, any advisories the planner picked up.

### Rule design — never touch legacy, tighten as you go

By far the hardest part is how *not* to touch legacy rules, and how to land new ones cleanly. The constraint that drove the design: the existing rulesets are decades old and cannot be modified by automation — too much could go wrong, and there's real complexity in deciding when to append vs. create.

So every rule the platform creates lives **above a known "green" anchor policy** on the target firewall. The anchor is a boundary marker — everything above it is managed by automation, everything below is legacy, and the two sides don't interfere. Firewalls evaluate top-down, so new rules hit first; legacy stays intact as a fallback. Anchor IDs live in config, one per device, so the planner knows exactly where to insert. Rolling back a bad change is just "delete the tagged rules above the anchor" — the legacy posture is never at risk.

The new rules are deliberately tighter than legacy tends to be. Each one is **scoped to a single application**, on the specific ports it actually needs, sourced from the CMDB lookup in Phase 1. Over time the security posture improves as a side effect of normal use — every new request adds a narrow, scoped rule above the anchor; the broad legacy rules below get exercised less and less.

Within those constraints the planner picks the smallest possible change, in order of preference:

1. **Reuse** — an existing group already covers what's needed; point the rule at it (or add a port to an existing rule).
2. **Extend** — an existing group is close; add the new hosts to it. No new rule needed if one already references the group.
3. **Create** — nothing fits; build a fresh group and a fresh rule above the anchor.

The choice matters because every rule is a future maintenance burden. Reusing groups keeps the ruleset's surface area small, and a single CMDB update to an application propagates through every rule that references it. **Per-zone constraints** — max hosts per group, max hosts per rule, max broad-prefix length, whether destination extension is allowed — feed the planner's decision. Regulated zones get strict planning; dev-test gets headroom. Same code, per-device behaviour, driven by config.

Phase 2 (change scheduling) and Phase 3 (push to the firewall management plane) mirror client onboarding — wait for approval, schedule the change, snapshot before, push, verify, snapshot after, close the ticket with a diff URL in the closure note.

The single highest-leverage thing the module does is the path-analysis check before the ticket. A meaningful fraction of requests turn out to be already-permitted — the developer didn't realise, traffic flows fine, no rule needed. Catching those before they reach security saves a five-day approval cycle for traffic that was never blocked. End result: firewall delivery time down ~97% — freeing us for governance, infra-as-code, and pushing further into self-healing architecture. Or making ourselves redundant.

## The network agent

Sitting on top of everything above is a network agent — the natural-language front door to the platform. Instead of knowing the right endpoint and the right JSON shape, you ask in plain English — *"is there a DNS record for `payments-stage-01`?"*, *"any tickets pending approval for me?"*, *"why can't this IP reach that VIP?"*, *"create a CNAME for `app.example.com` pointing at the staging VIP"* — and the agent figures out which tool to call, calls it, and writes back a sentence-shaped answer.

Under the hood it's Claude with around twenty-one tools wired up across every backend NAAS already integrates with — DNS, load balancer, firewall, ticketing, path analysis, the secure-access layer, the internal wiki, and email.

A few choices worth flagging:

- **Prompt caching.** Anthropic supports four cache breakpoints, so we cache the tool definitions, the NAAS OpenAPI spec, and the user's context to allow continuous conversations.
- **Defence-in-depth authorisation.** The agent runs HTTP calls to NAAS under a service account, but every write is re-checked against the *end user's* AD groups before the HTTP fires — using the same permissions matrix the platform itself reads, so it stays role-based end to end.
- **A LangGraph workflow for multi-step diagnostics.** *"Site not reached"* needs DNS → secure-access check → AD-group check → diagnosis, in order, with branches. Trying to express it as one tool ends in either a confidently-wrong answer or a tool that does too many things. A small typed graph keeps the steps testable in isolation and the branches explicit.

Integrating with our monitoring / observability tools and the automation platform has helped with initial L1 troubleshooting — users can query whether they have a firewall block between their servers, or a VPN block, or any access requirement. If it turns out to be a block, they have the choice to raise a ticket if it's not wired to NAAS; if it is wired, the agent calls the NAAS API and allows the rule for them then and there, same for creating DNS records straight from your words. Nothing fancy — but it's reduced a lot of pings to our team.

## What I picked up

Honestly, a lot. The whole project ended up being a crash course in backend engineering — Django, Postgres, observability, auth, all of it — plus modern LLM tooling (MCPs, LangChain, prompt caching) and a much deeper feel for how the network actually behaves at the edges.

## Where it's going next

The next direction for the platform is **self-healing networks** — in addition to request-driven automation and incident-driven response, a system that notices problems and fixes them on its own. The natural starting point is **BGP**, since it's the layer that's both rich enough to detect drift (route withdrawals, unexpected paths, session flaps, prefix leaks) and dynamic enough to need active correction. Additionally build new flows into the agent to analyze the latency or cpu alerts and make a decision to raise incident's only if it's a genuine problem or ignore if those alerts are just noise, finetuning alert space.

The rough shape: stream BGP state off the edge routers, compare it against intent (what *should* be advertised, what the best path *should* be), auto-remediate the things we know how to fix safely, and escalate everything else to the network team with the full context already attached. Same posture NAAS already has for firewall rules and DNS, just applied to the control plane rather than the policy plane. Long road, but the building blocks — telemetry, intent capture, the workflow scaffolding, the chatbot for human handoff — are already here.

That's the whole tour. Each module is the kind of thing that could easily be its own write-up; one day, if I feel like it, maybe.
