"use client";
import dynamic from "next/dynamic";
import { StandardForm, type StandardFormProps } from "./standard-form";
import { Loading } from "../ui/loading";

// Lazy load the question composer so regular forms don't pull in canvas/image attachments
const DynamicQuestionComposer = dynamic(
  () =>
    import("../question-composer").then((mod) => ({
      default: mod.QuestionComposer,
    })),
  {
    loading: () => <Loading text="Loading question composer…" />,
    ssr: false,
  }
);

export function Form(props: StandardFormProps) {
  const isQuestionComposer = props.fields.some(
    (field) => field.name === "questionText"
  );

  if (isQuestionComposer) {
    return <DynamicQuestionComposer {...props} />;
  }

  return <StandardForm {...props} />;
}
