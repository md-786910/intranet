# BrightNow Intranet — Product Documentation

## About This Document

This is a **product-level guide** to the BrightNow Intranet. It is written for:

- New team members joining the product
- Admins and operations staff configuring the system
- Managers and editors who publish content
- Anyone who needs to know *what the system does* without needing to know *how it is built*

It deliberately contains **no code, no commands, no API paths, and no database names.** Every feature is explained in plain business language, in the order a new user would most naturally discover it.

---

## Table of Contents

1. [What BrightNow Intranet Is](#1-what-BrightNow-intranet-is)
2. [Who Uses It](#2-who-uses-it)
3. [Core Concepts You Should Know First](#3-core-concepts-you-should-know-first)
4. [Signing In and Staying Secure](#4-signing-in-and-staying-secure)
5. [The Dashboard (Home Screen)](#5-the-dashboard-home-screen)
6. [Sidebar Navigation — The Feature Map](#6-sidebar-navigation--the-feature-map)
7. [Organisation Structure](#7-organisation-structure)
8. [User Management](#8-user-management)
9. [Roles and Permissions](#9-roles-and-permissions)
10. [News](#10-news)
11. [Documents](#11-documents)
12. [Push Notifications](#12-push-notifications)
13. [Analytics](#13-analytics)
14. [Access Control in Real Life (Worked Examples)](#14-access-control-in-real-life-worked-examples)
15. [Audit and Accountability](#15-audit-and-accountability)
16. [Safety and Trust Features](#16-safety-and-trust-features)
17. [Upcoming / Not Yet Available](#17-upcoming--not-yet-available)
18. [Appendix A — Every Module and Action](#18-appendix-a--every-module-and-action)
19. [Appendix B — Status Reference](#19-appendix-b--status-reference)
20. [Appendix C — Glossary](#20-appendix-c--glossary)

---

## 1. What BrightNow Intranet Is

BrightNow Intranet is a centralised **admin and communication platform** for the organisation. In one place it gives the business:

- A single source of truth for the **company structure** (offices, verticals, departments).
- A complete **user directory** with identity and job details.
- A **role and permissions system** so each person sees and does only what they should.
- A **news publishing system** with draft, review, and audience targeting.
- A **document library** with categories, versions, and controlled distribution.
- A **push notification system** for scheduled or immediate announcements.
- An **analytics overview** of platform activity.
- A full **audit trail** of who did what, when, and from where.

If the organisation previously used scattered email threads, shared drives, and spreadsheets to do all of that, this platform replaces them with one governed, permission-aware workspace.

---

## 2. Who Uses It

There are, broadly, four audiences:

| Audience | What They Do Here |
|---|---|
| **Platform Admins** | Set up the organisation tree, create roles, invite and manage users, see all analytics, view audit log. |
| **Content Publishers** | Write news articles, upload and version documents, plan push campaigns — usually for a specific part of the organisation. |
| **Team / Department Leads** | Manage people in their subtree (vertical or department), publish content targeted to their team, watch analytics for their scope. |
| **Regular Employees** | Read news, download documents, and receive push notifications that are targeted to them. *(Employee-facing read-only experience; the current admin panel focuses on the three audiences above.)* |

A single person can play more than one of these roles at the same time, and their permissions can be scoped to different parts of the organisation.

---

## 3. Core Concepts You Should Know First

Read this section once — it makes everything afterwards shorter.

### 3.1 The Four-Level Organisation Tree

Every piece of content, every user, and every permission in the system lives somewhere in a four-level tree:

```
Organisation
  └── Office Location
        └── Vertical
              └── Department
```

- **Organisation** — the company as a whole.
- **Office Location** — a physical or regional office (e.g., London, Mumbai).
- **Vertical** — a line of business or division (e.g., Retail, Corporate, Digital).
- **Department** — the smallest working unit (e.g., Finance, Talent, Design).

Almost every feature asks "*at which level in the tree does this apply?*"

### 3.2 Roles vs. Direct Permissions

A **permission** is a single right — for example, *publish news* or *manage users*.

A **role** is a named bundle of permissions that you can re-use. Assigning someone the "News Editor" role gives them every permission inside that role at once.

You can also grant **direct permissions** to a single person without using a role — useful for quick, temporary, or one-off cases.

### 3.3 Scope

Every role or permission is granted **within a scope** — a node of the organisation tree. For example:

- *"News Editor" on the **London Office***  → this person can edit news for London only.
- *"Manage Users" on the **Finance Department***  → this person can manage only Finance employees.

Scope is what prevents a "manager" in one part of the business from acting on another part.

### 3.4 Audience Targeting

When you create news, documents, or push campaigns you choose an **audience** — one or more nodes of the organisation tree. Only people who belong in that part of the tree will see the content. This is how the same platform can send London-specific news to London and India-specific policies to India without creating separate systems.

### 3.5 Workflow States

Most content in the platform has a lifecycle:

```
DRAFT  →  PUBLISHED  →  ARCHIVED
```

Push campaigns have their own variant:

```
DRAFT  →  SCHEDULED  →  SENT
                 └──────→  CANCELLED
```

### 3.6 Account States

A user's account can be **Active**, **Inactive**, or **Locked**. Locked is an automatic safety state when too many wrong passwords have been tried. Inactive is a deliberate admin choice.

---

## 4. Signing In and Staying Secure

### 4.1 Logging In

- Sign in with **email and password** on the login screen.
- A show/hide eye icon lets you confirm what you typed without leaking your password to bystanders.
- Once signed in, the system remembers you on that device so you don't have to log in every time you open the app.

### 4.2 Forgot Password

- A **Forgot Password** link on the login screen accepts your email.
- The request is recorded and the admin team can reset your password and send you a new one.
- *(Automatic emailed reset links are listed as not-yet-available in section 17.)*

### 4.3 Account Lock After Repeated Failures

If someone types the wrong password **five times in a row**, the account is **automatically locked for 30 minutes**. This protects against anyone trying to guess passwords. Admins can see the lock on the user's profile and can unlock the account sooner if needed.

### 4.4 Session Persistence

The platform keeps you signed in across page reloads and browser restarts, until you log out or until your session expires due to inactivity. When it expires, the next action will quietly redirect you to the login screen.

### 4.5 Logging Out

Clicking **Log Out** in the top-right header ends your session immediately on *every device* you were using. This is important — if you lose a device, changing your password will also end every session so the lost device becomes useless.

### 4.6 Changing Password

When you change your password, **every active session is ended everywhere** and you will have to log in again. This is deliberate and is the correct way to recover after a suspected compromise.

---

## 5. The Dashboard (Home Screen)

The dashboard is the first screen after signing in. It is designed to answer "*what's the state of the platform right now?*" in under two seconds.

**What you see:**

- A **welcome line** with your name.
- The **active organisation** you are working in.
- Four **headline metrics**:
  - Total Users
  - Published News
  - Total Documents
  - Number of Departments
- A small **quick info** panel with your profile and organisation context.

The dashboard is only visible to users with permission to view analytics. Other users will land on the first screen they do have access to.

---

## 6. Sidebar Navigation — The Feature Map

The left-hand sidebar is the complete map of the admin panel. Items you do not have permission for simply do not appear.

| # | Menu Item | What It Is For |
|---|---|---|
| 1 | **Dashboard** | Headline metrics and quick info. |
| 2 | **Organisation** | Manage the four-level company tree. |
| 3 | **Users** | Create, edit, deactivate, and assign roles to employees. |
| 4 | **Roles** | Define the named permission bundles used across the system. |
| 5 | **News** | Write, publish, and archive news articles. |
| 6 | **Documents** | Upload, version, categorise, and publish documents. |
| 7 | **Push** | Plan and send push notification campaigns. |
| 8 | **Analytics** | Multi-tab view of platform activity. |

At the very top of the header you will always see your name, your email, the organisation you are working in, and a **Log Out** button.

---

## 7. Organisation Structure

The Organisation page is the backbone of everything else. If the tree is wrong, permissions and audience targeting will be wrong too.

### 7.1 Viewing the Tree

The page shows the full four-level hierarchy as an expandable tree. Each node is rendered as a card showing:

- Its **type** (Organisation / Office Location / Vertical / Department), colour-coded.
- Its **name** and a short **code**.
- Address details where relevant (address line, city, country, time zone).
- Its **status** (Active / Inactive / Archived).
- When it was created and last updated.

### 7.2 Creating Nodes

At any node you can add a child of the next level down:

- On the **Organisation** you can add an **Office Location**.
- On an **Office Location** you can add a **Vertical**.
- On a **Vertical** you can add a **Department**.

Each level collects the fields that make sense for it — for example, time zone only matters at office level.

### 7.3 Editing and Removing Nodes

Every node has an **Edit** button (rename, change code, update address) and a **Delete** button (with a confirmation step). Deleting a node that has children is protected so you don't accidentally wipe out a whole branch of the business.

### 7.4 Why The Tree Matters

Because every role, every direct permission, and every piece of content is assigned to a node of this tree, the quality of this tree decides whether the platform feels tidy or chaotic.

---

## 8. User Management

The Users section is where every employee record lives.

### 8.1 Browsing Users

The user list is a paginated table with:

- A **search bar** that finds people by name or email as you type.
- A **status filter** (Active / Inactive / Locked).
- Columns for name + email, status, job title, and creation date.

Clicking a row opens the user's detail page.

### 8.2 Viewing a User

The detail page shows:

- Identity: first name, last name, email.
- Work details: job title, employee ID.
- Status badge and account timestamps.
- **Role assignments**: each role they hold, at which scope, with a count of effective permissions and an expandable permission matrix.
- **Direct permissions**: any single permissions assigned outside a role.
- Buttons to **Edit** or **Delete** the user, shown only if you have rights.

### 8.3 Creating a User

A single form captures:

- First name, last name, email.
- Status (defaults to Active).
- Phone, job title, employee ID.
- **Role assignments** with scope — you can assign multiple roles, each at its own node of the tree.
- **Direct permission assignments** with scope — for fine-grained exceptions.

### 8.4 Editing a User

The edit page has two tabs:

- **Profile** — change any of the details captured when creating.
- **Roles & Permissions** — remove existing role assignments, add new ones, and grant or remove direct permissions.

### 8.5 Deactivating or Locking a User

- **Inactive** is the correct state for employees who have left or are on long leave. They cannot sign in but their history remains.
- **Locked** is the automatic safety state after too many failed sign-ins.

Both are reversible. Neither destroys the user's history.

### 8.6 Bulk Import

For onboarding a large group at once, a **CSV upload** is supported. It expects the same fields as the create form.

---

## 9. Roles and Permissions

Roles keep the user model sane. Instead of assigning the same dozen permissions to fifty people, you assign them to a role once and then assign the role.

### 9.1 Browsing Roles

The list shows, for every role:

- Role **name**.
- A **permission summary** — how many permissions across how many modules. Expand it to see the breakdown.
- A **System** badge for built-in roles that cannot be altered.
- Creation date.

### 9.2 Creating a Role

A role has three text fields and one big control:

- **Name** — human-readable (e.g., "News Editor – London").
- **Code** — a short machine-friendly version, auto-suggested from the name.
- **Description** — what this role is for.
- **Permission matrix** — grouped by module, with a *Select all* per module and individual tick-boxes for each action. Every action is labelled in plain language (for example, "Publish news articles" rather than a cryptic token).

### 9.3 Cloning a Role

On any existing role you can click **Clone** to start a new role pre-filled with the same permissions. This is the fastest way to create "almost the same role but a bit different" without mistakes.

### 9.4 Editing and Deleting Roles

System roles are read-only to protect the platform. Custom roles can be renamed, have their permission matrix adjusted, or be deleted. Deleting a role removes it from every user who held it — a confirmation prompt makes sure this is deliberate.

### 9.5 Time-Limited Role Assignments

When you assign a role to a user you can optionally set a **start date** and an **end date**. This is the correct way to handle a contractor, an acting manager, or a trial period — the permissions quietly expire on the chosen date without anyone needing to remember to revoke them.

---

## 10. News

News is the publishing system for announcements, stories, and internal communication.

### 10.1 News Lifecycle

```
DRAFT  →  PUBLISHED  →  ARCHIVED
```

- **Draft** — saved but not visible to readers.
- **Published** — visible to the chosen audience.
- **Archived** — hidden from listings but preserved in the record.

### 10.2 Browsing Articles

The list uses **status tabs** (All / Draft / Published / Archived) plus a search bar. Columns show title with summary, status, author, and date. Clicking a row opens the article.

### 10.3 Creating an Article

The create form asks for:

- **Title** — required.
- **Summary** — a short blurb for the list view.
- **Body** — the article content.
- **Cover image** — optional.
- **Audience** — choose one or more nodes of the organisation tree; when you publish, only people inside those nodes will see the article.

Create saves the article as a **draft**; publishing is a separate, deliberate step.

### 10.4 Viewing an Article

The detail page shows title, status, author, dates, cover image, summary, body, and the current audience targets. Action buttons for **Publish**, **Archive**, **Edit**, and **Delete** appear depending on your permissions.

### 10.5 Editing

Edit re-opens the same form, pre-filled. Editing a published article does not unpublish it — the updated version simply replaces the existing one.

---

## 11. Documents

The Documents section is the controlled, versioned document library.

### 11.1 Document Lifecycle

```
DRAFT  →  PUBLISHED  →  ARCHIVED
```

Same three states as news, same meaning.

### 11.2 Browsing Documents

The list has a search bar, a **status filter**, and a **category filter**. Columns show title, status, category, author, and date.

### 11.3 Categories

Documents are organised into categories (for example, *HR Policies*, *IT Guidelines*, *Templates*). Categories can be created, renamed, and removed. Categorising a document is optional but recommended — it makes the category filter useful and lets readers find things faster.

### 11.4 Uploading a Document

The upload form captures:

- **Title** — required.
- **Summary** — what the document is about.
- **Category** — optional.
- **File** — required.
- **Audience** — which parts of the organisation can see it.

### 11.5 Versioning

Every document has a **version history**. Each version records the file name, the uploader, the upload date, and a short changelog. When a new version is uploaded the old one remains available in the history — nothing is lost.

### 11.6 Viewing a Document

The detail page shows the title, status, category, author, summary, the full version history, and the audience rules. Action buttons for **Publish**, **Edit**, and **Delete** appear based on permission.

---

## 12. Push Notifications

Push is the platform's broadcast channel for time-sensitive messages.

### 12.1 Campaign Lifecycle

```
DRAFT  →  SCHEDULED  →  SENT
                 └──────→  CANCELLED
```

- **Draft** — saved, not queued to send.
- **Scheduled** — set to send at a specific future date and time.
- **Sent** — delivered.
- **Cancelled** — a scheduled campaign that was stopped before it fired.

### 12.2 Browsing Campaigns

The campaign list shows title, status, creator, recipient count, and creation date.

### 12.3 Creating a Campaign

The create form asks for:

- **Title** — shown as the notification heading.
- **Message body** — the main text.
- **Schedule time** — optional; if empty, the campaign is saved as a draft and you can send it on demand.
- **Audience** — which parts of the organisation will receive it. Defaults to the current organisation context.

### 12.4 Sending and Cancelling

From the campaign detail page you can:

- **Send now** — deliver immediately to the chosen audience.
- **Schedule** — set a future date/time.
- **Cancel** — stop a scheduled campaign before it fires (cancelled campaigns stay in the list for record-keeping).

A confirmation step guards Send and Cancel so they cannot be triggered by mistake.

### 12.5 Recipient Count

Each campaign shows the number of recipients it *would* or *did* target, based on the audience selection. This lets the sender verify the reach before sending.

---

## 13. Analytics

Analytics provides a high-level view of platform activity.

### 13.1 Tabs

- **Overview** — headline metrics across the whole platform.
- **Content** — activity around news and documents.
- **Users** — activity around sign-ins and user engagement.
- **Push** — performance of push campaigns.

### 13.2 Overview Metrics

The Overview tab groups metrics into three cards:

- **Users** — total users, active users.
- **Organisation** — counts of office locations, verticals, departments.
- **Content** — counts of news articles, published news, documents, push campaigns.

Metrics load with skeleton placeholders so the page feels responsive on slow connections.

### 13.3 Access

Analytics is visible only to people with permission to view analytics. Scoped analytics (for a vertical or department) follow the same scoping rules as every other permission.

---

## 14. Access Control in Real Life (Worked Examples)

The combination of *Modules × Actions × Scope* is powerful but abstract. Here is how it looks in common real-world situations.

### 14.1 "Give the London Marketing lead the right to publish news for London only"

- Assign them the role **News Editor** *scoped to the London Office Location*.
- They will now see News in their sidebar, but can only publish articles whose audience is London or something inside London.

### 14.2 "A contractor needs to send one push campaign next Monday and nothing else"

- Assign them the permissions **Push: Create** and **Push: Send** *scoped to the relevant department*, with an **end date** of next Tuesday.
- After Tuesday, their push access evaporates without anyone having to remember.

### 14.3 "An employee has just resigned, lock them out immediately"

- Open their user profile.
- Set status to **Inactive**.
- All sessions on all devices end at once; their history and past content remain intact.

### 14.4 "Move a department from one vertical to another"

- Edit the department node in the organisation tree and reparent it.
- Every permission and audience that pointed at that department continues to point at it in its new home.

### 14.5 "Give someone a single extra permission without inventing a new role"

- Open the user's edit page → **Roles & Permissions** tab.
- Add a **direct permission** with its scope.
- You can remove it later without touching their roles.

---

## 15. Audit and Accountability

The audit trail is the platform's memory of what happened.

### 15.1 What Is Recorded

Every meaningful action is recorded, including:

- Sign-ins (success and failure).
- Creating, editing, deleting users, roles, organisation nodes, news, documents, and push campaigns.
- Publishing and archiving content.
- Sending or cancelling push campaigns.
- Password changes and session revocations.

### 15.2 What Each Record Captures

Each audit entry stores **who** performed the action, **when**, **from where** (IP address and browser), a **request identifier** to tie logs together, and whether the action **succeeded or failed**.

### 15.3 Why Audit Records Cannot Be Edited

Audit records are **append-only**. Nobody — not even a platform admin — can alter or delete them. This is deliberate: a tamperable log is not a log.

### 15.4 Sensitive Information Is Redacted

Fields such as passwords and authentication tokens are automatically stripped from every audit entry. The log remembers *that* a password was changed, never *what* it was changed to.

---

## 16. Safety and Trust Features

Things the platform does quietly in the background to protect the business and the people using it:

- **Automatic lock-out** after five failed sign-ins (30 minutes).
- **Session revocation on password change** — changing a password signs you out everywhere.
- **Rate limiting** on sign-in attempts and general usage to prevent abuse.
- **Input sanitisation** — rich-text fields are cleaned to prevent malicious content being embedded in news or documents.
- **Restricted cross-origin access** — only approved front-ends can talk to the platform.
- **Append-only audit log** (see section 15).
- **Scoped visibility** — users only ever see users, content, and analytics inside their scope.
- **Soft delete** — "deleted" content is hidden rather than destroyed, so mistakes can be recovered and history stays intact.

These are not features you configure — they are always on.

---

## 17. Upcoming / Not Yet Available

Honesty up-front so nobody assumes capabilities that don't yet exist:

- **Emailed password reset links** — the request form exists, but automated email delivery is not wired up. Admins handle resets manually today.
- **SMS notifications** — not available.
- **Two-factor authentication** — not available.
- **Profile photos** — the field exists on the user record, but there is no upload flow yet.
- **Employee directory (self-service search)** — reserved in the design, not built.
- **Saved / bookmarked items** — reserved in the design, not built.
- **Cloud file storage** — documents are stored on the server's own disk today.
- **Multiple tenants** — the design allows multiple separate organisations on one installation, but only a single organisation is in use.

These gaps are planned, not forgotten.

---

## 18. Appendix A — Every Module and Action

Every permission in the system is shaped like *Module → Action*. Here is the full list in plain English.

| Module | Actions |
|---|---|
| **News** | View · Create · Edit · Delete · Publish |
| **Documents** | View · Create · Edit · Delete · Publish |
| **Push** | View · Create · Send · Cancel |
| **Directory** | View · Export · Manage profiles |
| **Search** | Query |
| **Saved** | View · Save · Remove |
| **Analytics** | View |
| **Admin** | Manage Office Locations · Manage Verticals · Manage Departments · Manage Users · Manage Roles · View Platform Analytics · View Audit Log |

Every action is always granted **within a scope** — somewhere in the organisation tree.

---

## 19. Appendix B — Status Reference

| Where | Possible Statuses |
|---|---|
| **Content** (news, documents) | DRAFT · PUBLISHED · ARCHIVED |
| **Users** | ACTIVE · INACTIVE · LOCKED |
| **Push campaigns** | DRAFT · SCHEDULED · SENT · CANCELLED |
| **Organisation nodes** | ACTIVE · INACTIVE · ARCHIVED |

---

## 20. Appendix C — Glossary

- **Organisation** — the company as the top of the tree.
- **Office Location** — a physical/regional office under the organisation.
- **Vertical** — a business division under an office.
- **Department** — a working unit under a vertical.
- **Role** — a named bundle of permissions.
- **Permission** — a single right, always *Module → Action*.
- **Scope** — the node of the organisation tree where a role or permission applies.
- **Audience** — the nodes of the organisation tree that will see a piece of content.
- **Draft / Published / Archived** — the lifecycle states of content.
- **Scheduled / Sent / Cancelled** — the lifecycle states unique to push campaigns.
- **Locked account** — the automatic safety state after repeated wrong passwords.
- **Audit entry** — a tamper-proof record of a single meaningful action.
- **Soft delete** — a deletion that hides but does not destroy.
- **Session** — a signed-in state on one device. Ending it signs that device out.
