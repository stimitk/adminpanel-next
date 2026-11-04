// A name with its ID code underneath, so records with the same name stay distinct.
export function Identity({ name, code }: { name: unknown; code: string | null }) {
  if (!name && !code) return <>—</>;
  return (
    <span className="identity">
      <span>{String(name || "—")}</span>
      {code && <code className="entity-code">{code}</code>}
    </span>
  );
}
