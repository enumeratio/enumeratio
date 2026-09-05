---
sidebar: false
aside: false
---

# Session client — live demo

A working proof-of-concept of the **session-mode** client: `makeServiceWorkerDb()` — one shared, observable
calculation surface across every open tab, built from a **SharedWorker engine** (the one pglite) plus a
**ServiceWorker controller** (versioned control + notification singleton). See the design writeup in
[Service worker & the one-shot / session split](https://github.com/enumeratio/enumeratio/wiki/Service-Worker-and-Session).

**Try it:** run a query, then hit **open 2nd tab** — one engine serves both, and every query from either tab lands in
the single cross-tab activity log. **notify** fans a toast to all tabs; **flush SW** replaces the controller and reloads.

<ClientOnly>
<SessionDemo />
</ClientOnly>
