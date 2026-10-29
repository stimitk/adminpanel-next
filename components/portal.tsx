"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../lib/api";
import { portal } from "../lib/portal";
import { resources, unavailable } from "../lib/resources";
import { useAuth, Login, Signup, PasswordRecovery } from "./auth";
import { Shell } from "./shell";
import { Dashboard } from "./dashboard";
import { ResourcePage } from "./resource-page";
import {
  ChampionshipAnalytics,
  ChampionshipDetails,
  ChampionshipEditor,
  Championships,
} from "./championships";
import { QuestionBank, QuestionEditor } from "./questions";
import { QuestionSets } from "./question-sets";
import { Form, Heading, Loading, Notice, display } from "./ui";

function Unavailable({ name }: { name: string }) {
  const screen = unavailable[name];
  const admin = portal.kind === "admin";
  const contentFields =
    admin && /^(help|privacy)\//.test(name)
      ? [
          {
            name: "content",
            label: "Content",
            type: "textarea" as const,
            required: true,
          },
        ]
      : screen.fields;
  return (
    <>
      <Heading title={screen.title} />
      <section className="paper">
        <Notice kind="info">{screen.message}</Notice>
        {contentFields && (
          <Form
            fields={contentFields}
            disabled
            onSubmit={async () => {
              throw new Error("This action is unavailable.");
            }}
            submitLabel="Save"
          />
        )}
        {name === "users" && (
          <Link className="button secondary" href="/analytics">
            View championship participants
          </Link>
        )}
        {name === "account/password" && (
          <Link className="button secondary" href="/forgot-password">
            Request password reset
          </Link>
        )}
      </section>
    </>
  );
}
function Account() {
  const { profile } = useAuth();
  return (
    <>
      <Heading title="My Profile" />
      <section className="paper">
        <dl className="details-list">
          {[
            ["Name", profile?.name],
            ["Username", profile?.username],
            ["Email", profile?.email],
            ["Role", profile?.role],
            ["Institute", profile?.institute],
            ["Department", profile?.department],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{display(value)}</dd>
            </div>
          ))}
        </dl>
        <Notice kind="info">
          Profile updates and image uploads are not available yet.
        </Notice>
        <Link href="/forgot-password">Reset password</Link>
      </section>
    </>
  );
}
function Contact() {
  const { profile } = useAuth();
  return (
    <>
      <Heading
        title="Contact"
        description="Send a message to the kGamify team."
      />
      <section className="paper">
        <Form
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "subject", label: "Subject", required: true },
            {
              name: "message",
              label: "Message",
              type: "textarea",
              required: true,
            },
          ]}
          initial={{
            name: profile?.name || profile?.username,
            email: profile?.email,
          }}
          submitLabel="Send message"
          onSubmit={async (body) => {
            await api("/support/contact", {
              method: "POST",
              public: true,
              body,
            });
          }}
        />
      </section>
    </>
  );
}
const adminOnly = new Set([
  "institutes",
  "departments",
  "qualifications",
  "companies",
  "advertisements",
  "teachers",
  "coins",
  "configs",
]);
function Screen({ route }: { route: string }) {
  const [section, id, action] = route.split("/");
  if (portal.kind === "teacher" && adminOnly.has(section))
    return (
      <>
        <Heading title="Access restricted" />
        <Notice kind="info">This screen belongs to the admin portal.</Notice>
      </>
    );
  if (route === "dashboard") return <Dashboard />;
  if (route === "account") return <Account />;
  if (route === "contact") return <Contact />;
  if (unavailable[route]) return <Unavailable name={route} />;
  if (section === "labels" && (!id || id === "new"))
    return <QuestionSets key={route} create={id === "new"} />;
  if (section === "championships") {
    if (id === "new") return <ChampionshipEditor />;
    if (id && action === "edit") return <ChampionshipEditor key={id} id={id} />;
    if (id) return <ChampionshipDetails key={id} id={id} />;
    return <Championships />;
  }
  if (section === "analytics")
    return <ChampionshipAnalytics key={id || "list"} id={id} />;
  if (section === "questions") {
    if (id === "new") return <QuestionEditor />;
    if (id === "import") return <QuestionSets importFirst />;
    if (id && action === "edit") return <QuestionEditor key={id} id={id} />;
    if (!id) return <QuestionBank />;
  }
  if (resources[section] && (!id || id === "new"))
    return <ResourcePage key={route} name={section} create={id === "new"} />;
  return (
    <>
      <Heading title="Page not found" />
      <section className="paper">
        <p>This page is not available.</p>
        <Link className="button" href="/dashboard">
          Return to dashboard
        </Link>
      </section>
    </>
  );
}
export function Portal() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const route = pathname.replace(/^\/|\/$/g, "") || "login";
  const publicRoute = [
    "login",
    "forgot-password",
    "reset-password",
    "signup",
  ].includes(route);
  useEffect(() => {
    if (route === "logout") {
      logout();
      return;
    }
    if (!publicRoute && !profile)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [route, publicRoute, profile, pathname, router]);
  if (route === "forgot-password") return <PasswordRecovery />;
  if (route === "reset-password") return <PasswordRecovery reset />;
  if (route === "signup") return <Signup />;
  if (route === "login")
    return profile ? (
      <Shell>
        <Dashboard />
      </Shell>
    ) : (
      <Login />
    );
  if (!profile || route === "logout")
    return (
      <main className="auth-page">
        <Loading />
      </main>
    );
  return (
    <Shell>
      <Screen route={route} />
    </Shell>
  );
}
