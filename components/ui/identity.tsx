// A name with its ID code underneath, so records with the same name stay distinct.
// `compact` puts the code beside the name on one line.
export function Identity({
  name,
  code,
  compact = false,
}: {
  name: unknown;
  code: string | null;
  compact?: boolean;
}) {
  if (!name && !code) return <>—</>;
  return (
    <span className={compact ? "identity compact" : "identity"}>
      <span>{String(name || "—")}</span>
      {code && <code className="entity-code">{code}</code>}
    </span>
  );
}
