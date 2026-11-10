// System cases that need signed-in sessions. They can't run without a staging
// deployment and a Supabase test project, so they are reported, never skipped silently.
import { blocked } from "../helpers/harness.mjs";

const WHY = "needs a staging deployment with a dedicated Supabase test project and test accounts; none exists, and production must not be changed";
const cases = {
    "ST-02": ["Valid sign-in for each role", "Password reset email to new password", "Session expiry during use", "Sign-out", "Refresh keeps the session", "Role-restricted routes when signed in"],
    "ST-03": ["Super admin dashboard", "Provision and remove accounts in the People page", "Role and classification changes", "Inquiry triage", "Owner analytics"],
    "ST-04": ["Create and edit a project in the form", "Invite a team", "Milestones and tasks in the UI", "Review mode: accept and send back", "Team management", "File management", "Close and reopen a project"],
    "ST-05": ["Crew Today and assigned projects", "Start and submit work in the UI", "Site photo upload on a phone viewport", "Sent-back work and its reason", "Crew messaging"],
    "ST-06": ["Client portal and dashboard figures", "Only approved updates and photos appear in the UI", "Shared documents", "Client messaging"],
    "ST-07": ["Task cards render", "Drag and drop between columns", "Failed move puts the card back", "Two users on one board", "Phone menu alternative to dragging"],
    "ST-08": ["Timeline renders tasks and milestones", "Drag a phase date and persist it", "Horizontal navigation and resizing", "Dates across viewer time zones"],
    "ST-09": ["Three signed-in contexts see changes without refresh", "Disconnect and reconnect"],
    "ST-10": ["Upload document and photo", "Preview and retrieve", "Oversized and invalid file in the UI", "Broken reference", "Delete where permitted"],
    "ST-11": ["Send, receive and persist messages in the UI", "Simultaneous conversations", "Failed send and reconnection"],
    "ST-12": ["Full lifecycle through the browser (the database-layer equivalent is IT-14.01)"],
    "ST-13": ["Kanban, Gantt, upload, messaging and dialogs across browsers and widths when signed in"],
    "ST-14": ["Project creation, task update, realtime latency, upload speed, dashboard load (the paper's 3-second requirement)"],
    "ST-15": ["Authenticated accessibility and keyboard use of the board, timeline and dialogs", "Session cookie flags on a real session"],
};
for (const [area, list] of Object.entries(cases))
    list.forEach((what, i) => blocked(`${area}.B${String(i + 1).padStart(2, "0")}`, "Authenticated browser", what, WHY));
