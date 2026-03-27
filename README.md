# Hackathon 2026 - Avasar Patra

Avasar Patra is a full-stack procurement intelligence platform built for Nepal vendors and procurement teams. It turns noisy tender listings into actionable opportunities, then helps teams decide, prepare, and execute faster.

## Problem We Faced

SMEs and local vendors lose good bidding opportunities because the process is fragmented and time-sensitive:

- Tender notices are spread across portals and are hard to monitor consistently.
- Teams spend too much time manually filtering irrelevant tenders.
- Decision-making is slow because risk, fit, and readiness are not visible in one place.
- Document readiness (expiry, missing files, compliance) is tracked manually and fails late.
- Cross-team execution (ownership, tasks, JV partners, pipeline status) has no single workflow.

## What We Solved

We created one integrated workflow from discovery to submission readiness:

- Automated tender ingestion from PPMO-style sources.
- Profile-aware matching and personalized ranking for each vendor.
- Decision support with boardroom brief insights and simulation.
- Execution layer for assignments, planning, and pipeline tracking.
- Document vault with expiry-aware readiness checks.
- In-app + email notification system to reduce missed opportunities.
- Organization and JV workflows for multi-party procurement collaboration.

## Complete Feature List

### 1 Access, Identity, and Roles

- User registration and login.
- Organization registration and role-aware access.
- JWT-based authenticated sessions.
- Protected routes for user, organization, and admin experiences.

### 2 Tender Discovery and Matching

- Public and personalized tender feeds.
- Vendor-profile-based matching logic.
- Match endpoint for personalized recommendations.
- Tender detail views and executive brief export.

### 3  Boardroom and Decision Support

- Boardroom Brief page for strategic review.
- Pressure snapshot and recommendation support.
- Scenario simulation via operations service endpoints.

### 4 Workflow and Operations

- Operations board for active tender pipeline.
- Assignment creation and completion tracking.
- Auto-plan generation for readiness tasks.
- Pipeline status updates and outcome recording.
- Estimate updates and simulation support.

### 5  Bookmarks and Monitoring

- Bookmark toggle and bookmark list.
- Saved opportunities for follow-up workflow.

### 6 Document Vault and Compliance Readiness

- Document upload and retrieval.
- Expiry update support.
- Vault view for at-a-glance compliance readiness.

### 7 Notifications and Digests

- Notification center with read/unread updates.
- Notification preference management.
- Email digest pipeline (SMTP-based, environment controlled).

### 8) Organization Portal and JV Collaboration

- Organization portal with dedicated routes.
- Organization tender create/list/update endpoints.
- JV join flow and JV partner discovery by tender.

### 9) Admin and Data Operations

- Admin dashboard stats and trend analytics.
- Manual scraper trigger from admin API.
- Digest batch trigger from admin API.
- Scheduled scraper and digest jobs with feature flags.

## Tech Stack

- Frontend: React 19, React Router, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt
- Scraping: Puppeteer
- Notifications: In-app model + Nodemailer SMTP

## Folder Structure

```text
hackathon-2026/
  README.md

  client/
    package.json
    vite.config.js
    tailwind.config.js
    postcss.config.js
    index.html
    public/
    src/
      main.jsx                 # app bootstrap
      App.jsx                  # route map + protected route composition
      index.css
      App.css
      api/
        client.js              # API client wrapper
      assets/
      components/
        ApiStatus.jsx
        DocumentHealth.jsx
        Layout.jsx
        ProtectedRoute.jsx
        TenderCard.jsx
        TenderModal.jsx
      context/
        AuthContext.jsx
        AuthContextObject.js
      hooks/
        useAuth.js
      pages/
        LandingPage.jsx
        AuthPage.jsx
        TenderFeedPage.jsx
        BoardroomBriefPage.jsx
        BookmarksPage.jsx
        VaultPage.jsx
        OperationsPage.jsx
        JVPage.jsx
        NotificationsPage.jsx
        OrganizationPortalPage.jsx
        AdminPage.jsx
      utils/
        documentStatus.js

  server/
    package.json
    index.js                   # express app + DB + schedulers
    seed.js                    # seed baseline data
    demoSetup.js               # hackathon demo bootstrap
    tenders_raw.json
    controllers/
      authController.js
      tenderController.js
      matchController.js
      bookmarkController.js
      documentController.js
      notificationController.js
      operationsController.js
      organizationController.js
      jvController.js
      adminController.js
    routes/
      authRoutes.js
      tenderRoutes.js
      matchRoutes.js
      bookmarkRoutes.js
      documentRoutes.js
      notificationRoutes.js
      operationsRoutes.js
      organizationRoutes.js
      jvRoutes.js
      adminRoutes.js
    models/
      User.js
      Tender.js
      Notification.js
      VendorPipeline.js
    middleware/
      auth.js
      upload.js
    scrapers/
    uploads/
    utils/
      scraper.js
      matching.js
      scoring.js
      email.js
      districts.js
```

## API Modules (High Level)

- /api/auth: register, organization register, login, current user
- /api/tenders: list, personalized list, detail, executive brief export
- /api/matches: matched opportunities
- /api/bookmarks: list and toggle bookmark
- /api/documents: list, upload, expiry update
- /api/notifications: list, preferences, mark-as-read
- /api/operations: board, estimate, simulation, assignments, outcome, status
- /api/organization: organization tender lifecycle
- /api/jv: join JV and partner listing
- /api/admin: stats, trends, run scraper, send digests


## Hackathon Value

Avasar Patra focuses on measurable throughput improvement:

- Faster tender discovery
- Better bid/no-bid decisions
- Lower readiness failures from document issues
- Higher team coordination across operations and JV workflows
- Lower miss rate through notification and digest automation

