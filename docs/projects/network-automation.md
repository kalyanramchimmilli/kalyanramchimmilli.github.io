---
title: Network automation platform
description: A self-service network automation platform — DNS, firewall rules, edge allow-listing, and an LLM-powered agent, built on Django + DRF.
tags: [Django, DRF, Python, Anthropic, LangGraph, Network Automation, REST API, PostgreSQL]
---

# Network automation platform

A self-service platform. A developer who wants a DNS record, a firewall rule, or an IP added to an allow-list shouldn't have to raise a ticket and wait two days. They hit an API, they get what they need, the network team stops doing the mundane bit.

## How it started

Tickets. Dozens a day, most of them boring, all of them blocking someone. A DNS record for a new service, a CNAME for a vanity URL, a client's IP that needed to be allow-listed by end of day — every one of them a two-line intent that took two days to land because of the ITSM roundtrip.

## What it looks like underneath

A Django + DRF service. It started life in Flask and got rewired into Django once we consolidated our infra services under a single developer portal — cleaner routing, one auth story, one admin panel. And the ORM, god that thing is good. I think I've forgotten SQL completely now. The admin — one more reason to forget SQL. The migrations story, all of it.

Functionally it's an API gateway sitting in front of a handful of downstream systems: an internal DNS appliance, a public DNS provider, a load balancer, an edge firewall for client-facing traffic, the internal firewall estate for ACLs, and the L2/L3 switching fabric.

Three things show up in every module and are worth pulling out before the modules themselves:

- **Auth.** Sits behind an internal AD-backed auth service. Basic auth in, resource groups out. Each endpoint declares the `(service, role)` pair it needs and the middleware rejects anything that doesn't have it. Same shape as every enterprise Django app you've ever seen — but the (service, role) pairing rather than a flat role list is what makes the permission matrix readable at scale.
- **Logs and notifications.** Two destinations on every action — the central log aggregator for forensics, and an internal chat channel plus an email DL for live awareness. The team sees DNS records being created and firewall changes scrolling past in real time. Feels weirdly good to watch, honestly.
- **Postgres + the Django admin.** DB started as SQLite, moved to Postgres. The admin panel doubles as ops-grade DB access, which is handy.

## DNS

The busiest module by a wide margin. Most of the traffic through the gateway is DNS — somebody wants an A record for a new service, a CNAME for a vanity URL, a TXT record — all of it. Especially the decomm jobs, dozens of tickets each day. Doing it ticket-driven was painful, hence this.

The module exposes a single REST surface — A, Host, CNAME, PTR, TXT — plus bulk operations for environment bootstrap. Calls fan out to a fairly standard enterprise DNS appliance underneath.

Two design choices that earned their keep:

- **Automatic view routing.** Enterprise DNS appliances let the same hostname resolve to different IPs depending on whether the query came from inside or outside the network. Callers used to pick the view themselves and got it wrong constantly — "why isn't my record resolving" was basically a support meme. The platform reads a config file and routes each request to the correct view based on the domain. Whole class of tickets, gone.
- **Verify after write.** Every successful create is followed by a lookup to confirm the record actually resolves. Sounds obvious, but "the API said 200" and "the record exists" are two different things when you're talking to appliances.

Bulk is non-atomic by design — there's no transactional API to roll back partial failures, so each record is attempted independently and the response is a per-entry result list. The right trade-off when the use case is bootstrapping dozens of records at once. Bulk was for niche workflows, especially the decomm one — that whole queue is off my plate now, fully automated, delivery time down from days to seconds.

## Firewall address-list automation

Getting a set of source IPs onto an allow-list on an edge device. The workflow looks simple, but the device sits at the edge of the network and a bad change is a very bad day — so it runs through a full ITSM workflow with requests, approvals, changes, change windows, all of it.

Three-phase async pipeline:

1. **Intake (synchronous).** Validates the IPs against a list of blocked ranges, checks if they're already on the relevant address list, raises a ticket on the requester's behalf if everything looks fine. Returns in under a second.
2. **Approval poll (background, every 5 min).** Watches the ticketing system for approvals, finds the next available maintenance window of the right length, and opens a scheduled change linked to the original ticket.
3. **Implementation (background, every 5 min).** Snapshot before, HA sync verify, apply the change to the active box across both prod and demo environments, verify sync didn't break, snapshot after, generate a diff URL, close the ticket.

If anything fails, the pipeline raises an incident, leaves the change in a clean `Failed` state, and stops. It deliberately does *not* try to fix itself up — that's how you get paged at 4 a.m. Fail loud, stay put, let a human decide.

Two flavours of distributed locking keep the workers honest: **per-ticket advisory locks** in Phase 2 so workers can process tickets in parallel without stepping on each other, and a **single global lock** in Phase 3 so only one worker touches the load balancer at any moment. Different problems, different granularity, same Postgres.

## Firewall (rule automation)

The most involved module in the platform by quite a stretch. Address-list automation is allow-listing on a device that already knows about the destination — comparatively easy. This module creates *new firewall rules* on the internal firewall estate. Real policy change, real firewall, real consequences if it's wrong.

Phase 1 is synchronous from the caller's point of view, then hands off to a background thread for the heavy lifting. It does most of the thinking:

- **Deduplicate.** One thing I learnt from a previous project: keep APIs granular. That earlier project processed everything synchronously — the client waiting on the connection for a minute or so — bad. So this splits submission from processing, and folds idempotency in as a side effect. Dedupe against in-flight requests with the same intent so a frontend retry or two engineers asking for the same rule don't produce two tickets.
- **Resolve** every source and destination to IPs and classify them against the org's network topology.
- **Policy-grid check.** A persistent matrix of allowed source-group → destination-group combinations. Requests that can't possibly be approved by policy get rejected early with a clear reason — much better than burning two days of security review on a request that was always going to be denied.
- **Path-analysis check, per flow.** For every `(src, dst, port, protocol)` combination, ask the network analysis platform what would actually happen today. Already-permitted flows drop out silently — no rule needed. Actively-denied flows are the ones we'll write a rule for. Errored flows park the request in a `NeedsReview` state for the network team to disposition manually.
- **CMDB lookup.** Each IP resolves back to its owning application. The app name becomes the address-group name on the firewall — rules reference *named groups*, not raw IPs, so future host changes don't mean editing the rule. Just update CMDB.
- **Plan build.** Decide *where* and *how* the rule should land on each affected firewall. The placement strategy below is the engineering bit I'm most pleased with.
- **Raise the ticket.** Justification, affected firewalls, any advisories the planner picked up.

### Rule design — never touch legacy, tighten as you go

By far the hardest part is how *not* to touch legacy rules, and how to land new ones cleanly. The constraint that drove the design: the existing rulesets are decades old and cannot be modified by automation. Too much could go wrong. There's real complexity in deciding when to append vs. create, and none of it is worth risking a legacy rule that's been holding production together for years.

So every rule the platform creates lives **above a known "green" anchor policy** on the target firewall. The anchor is a boundary marker — everything above it is managed by automation, everything below is legacy, and the two sides don't interfere. Firewalls evaluate top-down, so new rules hit first; legacy stays intact as a fallback. Anchor IDs live in config, one per device, so the planner knows exactly where to insert. Rolling back a bad change is just "delete the tagged rules above the anchor" — the legacy posture is never at risk. Cheap, clean, terrifyingly effective for how simple it is.

The new rules are deliberately tighter than legacy tends to be. Each one is **scoped to a single application**, on the specific ports it actually needs, sourced from the CMDB lookup in Phase 1. Over time the security posture improves as a side effect of normal use — every new request adds a narrow, scoped rule above the anchor; the broad legacy rules below get exercised less and less. Nobody's writing a "cleanup" ticket, it just happens.

Within those constraints the planner picks the smallest possible change, in order of preference:

1. **Reuse** — an existing group already covers what's needed; point the rule at it (or add a port to an existing rule).
2. **Extend** — an existing group is close; add the new hosts to it. If a rule already references the group, no new rule is needed at all.
3. **Create** — nothing fits; build a fresh group and a fresh rule above the anchor.

Order matters because every rule is a future maintenance burden. Reusing groups keeps the ruleset's surface area small, and a single CMDB update to an application propagates through every rule that references it. **Per-zone constraints** — max hosts per group, max hosts per rule, max broad-prefix length, whether destination extension is allowed — feed the planner's decision. Regulated zones get strict planning; dev-test gets headroom. Same code, per-device behaviour, driven by config.

Phase 2 (change scheduling) and Phase 3 (push to the firewall management plane) mirror the address-list workflow — wait for approval, schedule the change, snapshot before, push, verify, snapshot after, close the ticket with a diff URL in the closure note.

The single highest-leverage thing this module does is the **path-analysis check before the ticket**. A meaningful fraction of requests turn out to be already-permitted — the developer didn't realise, traffic flows fine, no rule needed. Catching those before they reach security saves a five-day approval cycle for traffic that was never blocked. That one check does more to shrink delivery time than anything else in the platform — freeing us up for governance, infra-as-code, and pushing further into self-healing architecture. Or making ourselves redundant.

## The network agent

Sitting on top of everything above is a network agent — the natural-language front door to the platform. Instead of knowing the right endpoint and the right JSON shape, you ask in plain English — *"is there a DNS record for `payments-stage-01`?"*, *"any tickets pending approval for me?"*, *"why can't this IP reach that VIP?"*, *"create a CNAME for `app.example.com` pointing at the staging VIP"* — and the agent figures out which tool to call, calls it, and writes back a sentence-shaped answer.

Under the hood it's Claude with a broad tool surface wired up across every backend the platform already integrates with — DNS, load balancer, firewall, ticketing, path analysis, the secure-access layer, the internal wiki, and email.

A few choices worth flagging:

- **Prompt caching.** Anthropic supports four cache breakpoints, so we cache the tool definitions, the platform's OpenAPI spec, and the user's context. Long conversations stay cheap and fast.
- **Defence-in-depth authorisation.** The agent runs HTTP calls under a service account, but every write is re-checked against the *end user's* AD groups before the HTTP fires — using the same permissions matrix the platform itself reads. Role-based end to end, no "the agent got hacked so it did admin things" story.
- **A LangGraph workflow for multi-step diagnostics.** *"Site not reached"* isn't one question, it's a sequence — DNS → secure-access check → AD-group check → diagnosis, in order, with branches. Trying to express that as one tool ends in either a confidently-wrong answer or a tool that does too many things. A small typed graph keeps the steps testable in isolation and the branches explicit. Feels overkill until the first time it saves you from a hallucinated diagnosis.

Wiring the agent into the monitoring/observability stack helped with initial L1 triage — users can ask whether they have a firewall block, a VPN block, an access requirement in the way. If it turns out to be a block and the fix isn't wired to the platform, the agent tells them where to raise a ticket. If it *is* wired, the agent just raises the rule request there and then — same for creating DNS records straight from words. Nothing fancy. But it's stripped a lot of pings off the team.

## What I picked up

Honestly, a lot. This ended up being a crash course in backend engineering — Django, Postgres, observability, auth, all of it — plus modern LLM tooling (MCPs, LangChain, prompt caching) and a much deeper feel for how the network actually behaves at the edges. Also: how much design leverage you get from thinking about *state transitions* rather than *endpoints*, and how many things quietly become easier once you stop fighting async.

## Where it's going next

**Self-healing networks.** In addition to request-driven automation and incident-driven response, a system that notices problems and fixes them on its own. The natural starting point is **BGP**, since it's the layer that's both rich enough to detect drift (route withdrawals, unexpected paths, session flaps, prefix leaks) and dynamic enough to need active correction. Alongside that, smarter alert triage in the agent — using historical context and topology to decide whether a latency or CPU alert is a real incident or noise, and only escalating the ones that matter.

The rough shape: stream BGP state off the edge routers, compare it against intent (what *should* be advertised, what the best path *should* be), auto-remediate the things we know how to fix safely, and escalate everything else to the network team with the full context already attached. Same posture the platform has for firewall rules and DNS, just applied to the control plane instead of the policy plane. Long road, but the building blocks — telemetry, intent capture, the workflow scaffolding, the agent for human handoff — are already sitting there.

Each module is the kind of thing that could easily be its own write-up. One day, maybe.
