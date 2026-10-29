"use client";
import { useState } from "react";
import Link from "next/link";
import { AdvertisementForm } from "./advertisement-form";
import { api, errorText, rowsOf } from "../lib/api";
import { resources } from "../lib/resources";
import { portal } from "../lib/portal";
import type { Row } from "../lib/types";
import {
  DataTable,
  Form,
  Heading,
  Loading,
  Notice,
  Retry,
  useLoad,
} from "./ui";

export function ResourcePage({
  name,
  create = false,
}: {
  name: string;
  create?: boolean;
}) {
  const resource = resources[name];
  const [revision, setRevision] = useState(0);
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const { data, loading, error } = useLoad<unknown>(
    create ? null : resource.endpoint,
    revision,
  );
  const canCreate =
    !!resource.fields && !(portal.kind === "teacher" && name === "categories");
  async function change(path: string, body: unknown, key: string) {
    setMutationError("");
    setBusy(key);
    try {
      await api(path, { method: "PATCH", body });
      setRevision((v) => v + 1);
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      setBusy(null);
    }
  }
  if (create)
    return (
      <>
        <Heading title={resource.createTitle || `New ${resource.title}`} />
        <section className="paper">
          {canCreate && name === "advertisements" ? (
            <AdvertisementForm
              onSubmit={async (body) => {
                await api(resource.endpoint, { method: "POST", body });
              }}
            />
          ) : canCreate ? (
            <Form
              fields={resource.fields!}
              submitLabel="Create"
              onSubmit={async (body) => {
                if (name === "advertisements")
                  body.aspectRatio =
                    body.placement === "home_banner" ? "16:9" : "6.78:1";
                await api(resource.endpoint, { method: "POST", body });
              }}
            />
          ) : (
            <Notice kind="info">
              Creating this record is not available for your account.
            </Notice>
          )}
        </section>
        <Link href={`/${name}`}>View {resource.title.toLowerCase()}</Link>
      </>
    );
  return (
    <>
      <Heading
        title={resource.title}
        action={
          canCreate ? (
            <Link className="button" href={resource.createPath!}>
              {resource.createTitle}
            </Link>
          ) : undefined
        }
      />
      {mutationError && <Notice>{mutationError}</Notice>}
      {editing && (
        <section className="paper">
          <h2>Update Coin Value</h2>
          <Form
            key={String(editing.coin_id)}
            fields={[
              {
                name: "coinValue",
                label: "Coin value",
                type: "number",
                required: true,
                min: 1,
              },
            ]}
            initial={{ coinValue: editing.coin_value }}
            onSubmit={async (body) => {
              await api(
                `/admin/configs/coins/${encodeURIComponent(String(editing.coin_id))}`,
                { method: "PUT", body },
              );
              setEditing(null);
              setRevision((v) => v + 1);
            }}
          />
          <button className="text-button" onClick={() => setEditing(null)}>
            Close editor
          </button>
        </section>
      )}
      <section className="paper">
        {loading ? (
          <Loading />
        ) : error ? (
          <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <DataTable
            rows={rowsOf(data)}
            columns={resource.columns}
            statusKind={name === "teachers" ? "teacher" : "default"}
            actions={
              name === "teachers"
                ? (row) => {
                    const id = String(row.teacher_id);
                    return (
                      <>
                        <button
                          className="small"
                          disabled={busy === id || row.status === 1}
                          onClick={() =>
                            change(
                              `/admin/teachers/${encodeURIComponent(id)}/status`,
                              { status: 1 },
                              id,
                            )
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="small secondary"
                          disabled={busy === id || row.status === 2}
                          onClick={() =>
                            change(
                              `/admin/teachers/${encodeURIComponent(id)}/status`,
                              { status: 2 },
                              id,
                            )
                          }
                        >
                          Suspend
                        </button>
                      </>
                    );
                  }
                : name === "coins"
                  ? (row) => (
                      <button
                        className="small secondary"
                        onClick={() => setEditing(row)}
                      >
                        Edit
                      </button>
                    )
                  : undefined
            }
          />
        )}
      </section>
    </>
  );
}
