"use client";
import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../lib/api";
import { portal } from "../lib/portal";
import { resources, unavailable } from "../lib/resources";
import { useAuth } from "./auth";
import { Shell } from "./shell";
import {
  Form,
  Heading,
  Loading,
  Notice,
  SkeletonPage,
  Card,
  Button,
  display,
} from "./ui";

// Code-split all page screens with instant layout-matched Skeleton fallbacks
const Dashboard = dynamic(
  () => import("./dashboard").then((m) => ({ default: m.Dashboard })),
  {
    loading: () => <SkeletonPage withMetrics cards={2} />,
  }
);

const Championships = dynamic(
  () => import("./championships").then((m) => ({ default: m.Championships })),
  {
    loading: () => <SkeletonPage cards={1} />,
  }
);

const ChampionshipEditor = dynamic(
  () =>
    import("./championships").then((m) => ({ default: m.ChampionshipEditor })),
  {
    loading: () => <SkeletonPage cards={1} />,
  }
);

const ChampionshipDetails = dynamic(
  () =>
    import("./championships").then((m) => ({
      default: m.ChampionshipDetails,
    })),
  {
    loading: () => <SkeletonPage cards={2} />,
  }
);

const ChampionshipAnalytics = dynamic(
  () =>
    import("./championships").then((m) => ({
      default: m.ChampionshipAnalytics,
    })),
  {
    loading: () => <SkeletonPage withMetrics cards={1} />,
  }
);

const QuestionBank = dynamic(
  () => import("./questions").then((m) => ({ default: m.QuestionBank })),
  {
    loading: () => <SkeletonPage cards={1} />,
  }
);

const QuestionEditor = dynamic(
  () => import("./questions").then((m) => ({ default: m.QuestionEditor })),
  {
    loading: () => <SkeletonPage cards={1} />,
  }
);

const QuestionSets = dynamic(
  () => import("./question-sets").then((m) => ({ default: m.QuestionSets })),
  {
    loading: () => <SkeletonPage cards={1} />,
  }
);

const ResourcePage = dynamic(
  () => import("./resource-page").then((m) => ({ default: m.ResourcePage })),
  {
    loading: () => <SkeletonPage cards={1} />,
  }
);

const Login = dynamic(
  () => import("./auth").then((m) => ({ default: m.Login })),
  {
    loading: () => (
      <main className="auth-page">
        <Loading text="Loading sign in…" />
      </main>
    ),
  }
);

const Signup = dynamic(
  () => import("./auth").then((m) => ({ default: m.Signup })),
  {
    loading: () => (
      <main className="auth-page">
        <Loading text="Loading sign up…" />
      </main>
    ),
  }
);

const PasswordRecovery = dynamic(
  () => import("./auth").then((m) => ({ default: m.PasswordRecovery })),
  {
    loading: () => (
      <main className="auth-page">
        <Loading text="Loading recovery…" />
      </main>
    ),
  }
);

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
      <Card>
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
          <Button variant="secondary" href="/analytics" style={{ marginTop: 12 }}>
            View championship participants
          </Button>
        )}
        {name === "account/password" && (
          <Button variant="secondary" href="/forgot-password" style={{ marginTop: 12 }}>
            Request password reset
          </Button>
        )}
      </Card>
    </>
  );
}

function Account() {
  const { profile } = useAuth();
  return (
    <>
      <Heading title="My Profile" />
      <Card>
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
      </Card>
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
      <Card>
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
      </Card>
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
      <Card>
        <p>This page is not available.</p>
        <Button href="/dashboard">Return to dashboard</Button>
      </Card>
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
