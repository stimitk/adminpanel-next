"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorText, rowsOf } from "../lib/api";
import { questionFields } from "../lib/resources";
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

export function QuestionBank() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [revision, setRevision] = useState(0);
  const query = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
    ...(label ? { labelId: label } : {}),
  });
  const { data, loading, error } = useLoad<{ questions: Row[]; total: number }>(
    `/questions/?${query}`,
    revision,
  );
  const labels = useLoad<unknown>("/questions/labels");
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSearch(String(form.get("search") || ""));
    setLabel(String(form.get("label") || ""));
    setPage(1);
  }
  return (
    <>
      <Heading
        title="Question Bank"
        action={
          <Link className="button" href="/questions/new">
            New Question
          </Link>
        }
      />
      <section className="paper">
        <form className="filter-bar" onSubmit={filter}>
          <label>
            Question text
            <input type="search" name="search" placeholder="Search questions" />
          </label>
          <label>
            Question set
            <select name="label" defaultValue="">
              <option value="">All question sets</option>
              {rowsOf(labels.data).map((row) => (
                <option key={String(row.label_id)} value={String(row.label_id)}>
                  {String(row.label_name)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Filter</button>
        </form>
        {labels.error && <Notice>{labels.error}</Notice>}
        {loading ? (
          <Loading />
        ) : error ? (
          <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <>
            <DataTable
              rows={data?.questions || []}
              columns={[
                ["question_text", "Question"],
                ["label_name", "Question set"],
                ["option1_text", "Option 1"],
                ["option2_text", "Option 2"],
                ["option3_text", "Option 3"],
                ["option4_text", "Option 4"],
                ["total_coins", "Coins"],
              ]}
              actions={(row) => (
                <Link
                  className="button small secondary"
                  href={`/questions/${encodeURIComponent(String(row.question_id))}/edit?${new URLSearchParams({ ...(search ? { search } : {}), ...(label ? { labelId: label } : {}), page: String(page) })}`}
                >
                  Edit
                </Link>
              )}
            />
            <div className="pagination">
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of{" "}
                {Math.max(1, Math.ceil(Number(data?.total || 0) / 20))}
              </span>
              <button
                className="secondary"
                disabled={page * 20 >= Number(data?.total || 0)}
                onClick={() => setPage((v) => v + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
export function QuestionEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [lookup, setLookup] = useState("");
  const [loaded, setLoaded] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Reuse the bank's page/filter context when following its Edit link.
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const query = new URLSearchParams({
      page: String(Math.max(1, Number(params.get("page")) || 1)),
      limit: "20",
    });
    for (const key of ["search", "labelId"]) {
      const value = params.get(key);
      if (value) query.set(key, value);
    }
    setBusy(true);
    api<{ questions: Row[] }>(`/questions/?${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        const found = data.questions.find(
          (row) => String(row.question_id) === id,
        );
        if (found) setLoaded(found);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [id]);
  // No GET /questions/:id is documented. The selector below searches the documented bank.
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setLoaded(null);
    try {
      const query = new URLSearchParams({
        limit: "100",
        page: "1",
        ...(lookup ? { search: lookup } : {}),
      });
      const data = await api<{ questions: Row[] }>(`/questions/?${query}`);
      const found = data.questions.find(
        (row) => String(row.question_id) === id,
      );
      if (!found)
        throw new Error(
          "Question not found. Try searching a word from the question, or return to the question bank.",
        );
      setLoaded(found);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const initial: Record<string, unknown> = loaded
    ? {
        labelId: loaded.label_id,
        questionText: loaded.question_text,
        questionImage: loaded.question_image,
        option1Text: loaded.option1_text,
        option2Text: loaded.option2_text,
        option3Text: loaded.option3_text,
        option4Text: loaded.option4_text,
        option1Img: loaded.option1_img,
        option2Img: loaded.option2_img,
        option3Img: loaded.option3_img,
        option4Img: loaded.option4_img,
        correctAnswer: loaded.correct_answer,
        totalCoins: loaded.total_coins,
        expectedTimeSeconds: loaded.expected_time_sec,
      }
    : {};
  // PUT supports question and option images. Duration remains creation-only.
  const fields = id
    ? questionFields.filter((f) => f.name !== "expectedTimeSeconds")
    : questionFields;
  return (
    <>
      <Heading title={id ? "Edit Question" : "New Question"} />
      {id && !loaded && (
        <section className="paper">
          <p>
            Load the question before editing. You can narrow the lookup with a
            word from its text.
          </p>
          <form className="filter-bar" onSubmit={load}>
            <label>
              Question text
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder="Optional search text"
              />
            </label>
            <button disabled={busy}>
              {busy ? "Loading…" : "Load question"}
            </button>
          </form>
          {error && <Notice>{error}</Notice>}
        </section>
      )}
      {(!id || loaded) && (
        <section className="paper">
          <Form
            key={id || "new"}
            fields={fields}
            initial={initial}
            submitLabel={id ? "Save question" : "Add question"}
            onSubmit={async (values) => {
              await api(
                id ? `/questions/${encodeURIComponent(id)}` : "/questions/",
                { method: id ? "PUT" : "POST", body: values },
              );
              router.push("/questions");
            }}
          />
        </section>
      )}
    </>
  );
}
