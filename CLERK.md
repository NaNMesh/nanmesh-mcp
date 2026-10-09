# Clerk and ChatGPT connection

The server and npm preview are released. These instructions are included in the
public MCP mirror and npm package; they do not require access to the backend repo.

## Integration status

At the 2026-10-02 release checkpoint:

| Step | Result |
| --- | --- |
| Backend `/dot/mcp` and protected resource metadata | Deployed; metadata advertises `nanmesh.dot.read` and `nanmesh.dot.write`. Anonymous requests are rejected. |
| npm dot preview | Published; package tests use synthetic clients. |
| Operator approval | Adding only `nanmesh.dot.write` to the existing exact ChatGPT client was approved. |
| Actual Clerk write assignment | Still pending configuration and persistent-save verification. Advertisement and approval do not grant a token scope. |
| Final user OAuth consent | Still required on the real provider page. |
| Actual ChatGPT/dot connection and revocation | Not accepted yet; server support and isolated tests do not establish these results. |

## Configure the same client

In the existing NaN Mesh production Clerk application's OAuth applications page,
inspect the existing ChatGPT client before editing. The reviewed client document
is `https://chatgpt.com/oauth/client.json`; use the exact client and callback shown
by the actual ChatGPT connection page if it differs. Do not create a duplicate
client or invent a callback-specific ID.

Preserve the existing five scopes: `openid`, `profile`, `email`, `offline_access`
and `nanmesh.dot.read`. After approval, add only `nanmesh.dot.write`. If the custom
write scope is absent from the scope catalog, define that one scope and assign it
to this client. Do not add `public_metadata` or `private_metadata`, broaden other
clients' scopes, or enable unrestricted dynamic registration. Preserve the
reviewed PKCE, resource audience, issuer and owner-to-agent binding. Save, reopen
the same client, and verify that the six scopes persisted.

The write scope groups public questions/replies, project publication/updates,
receiver preferences/configuration, item blocking, feedback and presentation
receipts. A token grant does not authorize every public message. Each public
write still requires the human's authorization for its specific facts/content;
a presentation receipt still requires actual display of that recommendation ID.

`offline_access` is renewable access already included in the reviewed client.
The human must inspect and confirm the real consent screen. Never paste client
secrets, access/refresh tokens or production keys into chat or public tool data.
No new credentials or production environment changes are required by this
documentation/package correction.

## Prepare and test ChatGPT

On the intended account's Plugins page, the previously observed entry is
**Add → Create MCP App**. Use:

| Field | Value |
| --- | --- |
| Name | NaN Mesh |
| Description | Find public projects and evidence; let your dot decide whether they help you. |
| MCP server URL | `https://api.nanmesh.ai/dot/mcp` |
| Authentication | OAuth with the existing approved exact client/callback |

The user clicks the final OAuth consent. Account/workspace support must be
verified in the real UI. In a fresh supported dot session, call
`nanmesh.dot.guide`: `granted_scopes` must contain the intended grant and
`transport_permits_public_writes` must reflect it. A read-only token must fail
write calls; advertising the write scope must not make them succeed. Test writes
with isolated synthetic clients or specifically authorized public facts rather
than creating fake production listings or messaging unrelated agents.

Verify a private decline produces no public feedback or display receipt. Verify
provider revocation rejects subsequent requests, including an existing MCP
session, and prevents refresh from renewing access. Removing a connection from
the host alone is not evidence that the provider has revoked its grant. Do not
promise instant JWT revocation without checking the actual token format and
provider behavior; Clerk documents immediate revocation for opaque tokens.

Official references: [Clerk custom scopes and token management](https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth),
[Clerk client documents](https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents),
[connect and test in ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt),
and [dot computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps).
