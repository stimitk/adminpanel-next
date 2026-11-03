"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api, errorText, rowsOf } from "../lib/api";
import { resources } from "../lib/resources";
import { teacherCode } from "../lib/codes";
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
  Card,
  Button,
  IconActions,
  IconButton,
  useConfirm,
} from "./ui";

// Dynamically import heavy AdvertisementForm with cropper and canvas routines
const DynamicAdvertisementForm = dynamic(
  () =>
    import("./advertisement-form").then((mod) => ({
      default: mod.AdvertisementForm,
    })),
  {
    loading: () => <Loading text="Loading advertisement editor…" />,
    ssr: false,
  }
);

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
  const { confirm, dialog } = useConfirm();
  const { data, loading, error } = useLoad<unknown>(
    create ? null : resource.endpoint,
    revision,
  );
  const canCreate =
    !!resource.fields && !(portal.kind === "teacher" && name === "categories");

  async function setTeacherStatus(row: Row, status: 1 | 2) {
    const id = String(row.teacher_id);
    const name = String(row.teacher_name || "this teacher");
    if (
      !(await confirm({
        title: status === 1 ? "Approve teacher?" : "Suspend teacher?",
        message:
          status === 1
            ? `${name} will be able to sign in and create question sets and championships.`
            : `${name} will not be able to sign in until approved again. Their content is kept.`,
        confirmLabel: status === 1 ? "Approve" : "Suspend",
        isDangerous: status === 2,
      }))
    )
      return;
    return change(`/admin/teachers/${encodeURIComponent(id)}/status`, { status }, id);
  }
  async function change(path: string, body: unknown, key: string) {
    setMutationError("");
    setBusy(key);
    try {
      await api(path, { method: "PATCH", body });
      setRevision((v) => v + 1);
    } catch (err) {
      setMutationError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  if (create)
    return (
      <>
        <Heading title={resource.createTitle || `New ${resource.title}`} />
        <Card>
          {canCreate && name === "advertisements" ? (
            <DynamicAdvertisementForm
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
        </Card>
        <Link href={`/${name}`} style={{ marginTop: 12, display: "inline-block" }}>
          View {resource.title.toLowerCase()}
        </Link>
      </>
    );

  return (
    <>
      <Heading
        title={resource.title}
        action={
          canCreate ? (
            <Button href={resource.createPath!}>
              {resource.createTitle}
            </Button>
          ) : undefined
        }
      />
      {mutationError && <Notice kind="error">{mutationError}</Notice>}
      {editing && (
        <Card style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 16px" }}>Update Coin Value</h2>
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
          <button
            className="text-button"
            onClick={() => setEditing(null)}
            style={{ marginTop: 12 }}
          >
            Close editor
          </button>
        </Card>
      )}
      <Card>
        {loading ? (
          <DataTable
            rows={[]}
            columns={resource.columns}
            loading={true}
          />
        ) : error ? (
          <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <DataTable
            rows={
              name === "teachers"
                ? rowsOf(data).map((row) => ({ ...row, teacher_code: teacherCode(row) }))
                : rowsOf(data)
            }
            serial
            sortable={resource.columns.map(([key]) => key)}
            columns={resource.columns}
            statusKind={name === "teachers" ? "teacher" : "default"}
            actions={
              name === "teachers"
                ? (row) => {
                    const id = String(row.teacher_id);
                    return (
                      <IconActions>
                        <IconButton
                          icon="approve"
                          label="Approve teacher"
                          tone="success"
                          loading={busy === id}
                          disabled={busy === id || row.status === 1}
                          disabledReason="Already approved"
                          onClick={() => setTeacherStatus(row, 1)}
                        />
                        <IconButton
                          icon="block"
                          label="Suspend teacher"
                          tone="danger"
                          disabled={busy === id || row.status === 2}
                          disabledReason="Already suspended"
                          onClick={() => setTeacherStatus(row, 2)}
                        />
                      </IconActions>
                    );
                  }
                : name === "coins"
                  ? (row) => (
                      <IconActions>
                        <IconButton
                          icon="edit"
                          label="Edit coin value"
                          onClick={() => setEditing(row)}
                        />
                      </IconActions>
                    )
                  : undefined
            }
          />
        )}
      </Card>
      {dialog}
    </>
  );
}
