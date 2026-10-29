import type { Field, Resource } from "./types";
const required = (
  name: string,
  label: string,
  type: Field["type"] = "text",
): Field => ({ name, label, type, required: true });
export const resources: Record<string, Resource> = {
  labels: {
    title: "Question Sets",
    endpoint: "/questions/labels",
    columns: [
      ["label_name", "Question set"],
      ["status", "Status"],
    ],
    createTitle: "New Question Set",
    createPath: "/labels/new",
    fields: [
      {
        ...required("labelName", "Question set name"),
        minLength: 2,
        maxLength: 50,
      },
    ],
  },
  categories: {
    title: "Categories",
    endpoint: "/questions/categories",
    columns: [
      ["category_name", "Category"],
      ["status", "Status"],
    ],
    createTitle: "New Category",
    createPath: "/categories/new",
    fields: [
      {
        ...required("categoryName", "Category name"),
        minLength: 2,
        maxLength: 50,
      },
    ],
  },
  institutes: {
    title: "Institutes",
    endpoint: "/admin/institutes",
    columns: [
      ["institute_name", "Institute"],
      ["institute_abbreviation", "Abbreviation"],
      ["institute_address", "Address"],
      ["institute_url", "Website"],
    ],
    createTitle: "New Institute",
    createPath: "/institutes/new",
    fields: [
      required("name", "Institute name"),
      required("abbreviation", "Abbreviation"),
      required("address", "Address", "textarea"),
      { name: "url", label: "Website", type: "url" },
    ],
  },
  departments: {
    title: "Departments",
    endpoint: "/admin/departments",
    columns: [
      ["department_name", "Department"],
      ["institute_name", "Institute"],
    ],
    createTitle: "New Department",
    createPath: "/departments/new",
    fields: [
      {
        ...required("instituteId", "Institute", "select"),
        source: "institutes",
      },
      required("departmentName", "Department name"),
    ],
  },
  qualifications: {
    title: "Qualifications",
    endpoint: "/admin/qualifications",
    columns: [["qualification_name", "Qualification"]],
    createTitle: "New Qualification",
    createPath: "/qualifications/new",
    fields: [required("name", "Qualification name")],
  },
  companies: {
    title: "Companies",
    endpoint: "/admin/companies",
    columns: [
      ["company_name", "Company"],
      ["contact_person_name", "Contact person"],
      ["contact_person_email", "Email"],
      ["company_phone_number", "Phone"],
    ],
    createTitle: "New Company",
    createPath: "/companies/new",
    fields: [
      required("companyName", "Company name"),
      required("companyAddress", "Address", "textarea"),
      required("companyPhoneNumber", "Company phone"),
      { name: "companyWebsite", label: "Website", type: "url" },
      required("companyDescription", "Description", "textarea"),
      required("contactPersonName", "Contact person"),
      required("contactPersonEmail", "Contact email", "email"),
      required("contactPersonPhone", "Contact phone"),
    ],
  },
  advertisements: {
    title: "Advertisements",
    endpoint: "/admin/advertisements",
    columns: [
      ["title", "Title"],
      ["company_name", "Company"],
      ["placement", "Placement"],
      ["status", "Status"],
      ["ad_link", "Target URL"],
    ],
    createTitle: "New Advertisement",
    createPath: "/advertisements/new",
    fields: [
      { ...required("companyId", "Company", "select"), source: "companies" },
      required("title", "Title"),
      required("adDescription", "Description", "textarea"),
      {
        ...required("adImage", "Image URL", "url"),
        hint: "Use the URL of an image already hosted on your media service.",
      },
      required("adLink", "Target URL", "url"),
      {
        ...required("placement", "Placement", "select"),
        value: "home_banner",
        options: [
          { value: "home_banner", label: "Home banner — 16:9" },
          { value: "championship_card", label: "Championship card — 6.78:1" },
          { value: "question_view", label: "Question view — 6.78:1" },
        ],
      },
    ],
  },
  teachers: {
    title: "Teachers",
    endpoint: "/admin/teachers",
    columns: [
      ["teacher_name", "Name"],
      ["username", "Username"],
      ["email", "Email"],
      ["institute", "Institute"],
      ["department", "Department"],
      ["status", "Status"],
    ],
  },
  coins: {
    title: "Coin Values",
    endpoint: "/admin/configs/coins",
    columns: [
      ["coin_id", "ID"],
      ["coin_value", "Coin value"],
    ],
  },
  "frequent-errors": {
    title: "Wrong Questions",
    endpoint: "/questions/analytics/frequent-errors",
    columns: [
      ["question_text", "Question"],
      ["error_count", "Incorrect answers"],
    ],
  },
};
export const questionFields: Field[] = [
  { ...required("labelId", "Question set", "select"), source: "labels" },
  required("questionText", "Question", "richtext"),
  { name: "questionImage", label: "Question image URL", type: "url" },
  ...[1, 2, 3, 4].flatMap((n) => [
    required(`option${n}Text`, `Option ${n}`),
    {
      name: `option${n}Img`,
      label: `Option ${n} image URL`,
      type: "url" as const,
    },
  ]),
  {
    ...required("correctAnswer", "Correct option", "select"),
    options: [1, 2, 3, 4].map((n) => ({
      value: String(n),
      label: `Option ${n}`,
    })),
  },
  {
    ...required("expectedTimeSeconds", "Expected time (seconds)", "number"),
    min: 5,
    max: 300,
    value: "20",
  },
  { ...required("totalCoins", "Coins", "number"), min: 1, value: "10" },
];
export const championshipFields: Field[] = [
  {
    ...required("champName", "Championship name"),
    minLength: 2,
    maxLength: 100,
  },
  { ...required("categoryId", "Category", "select"), source: "categories" },
  required("startDate", "Start date", "date"),
  required("startTime", "Start time", "time"),
  required("endDate", "End date", "date"),
  required("endTime", "End time", "time"),
  {
    ...required("modeName", "Game mode", "select"),
    options: [
      { value: "Play and win", label: "Play and win" },
      { value: "Quick Hit", label: "Quick Hit" },
    ],
  },
  { name: "description", label: "Game description", type: "textarea" },
  {
    ...required("noOfQuestions", "Number of questions", "number"),
    min: 1,
    max: 100,
    value: "10",
  },
  {
    ...required("durationMinutes", "Duration (minutes)", "number"),
    min: 1,
    max: 1439,
    value: "10",
  },
  {
    name: "labelIds",
    label: "Question sets",
    type: "multiselect",
    source: "labels",
    hint: "Select one or more sets. Hold Ctrl or Command to select multiple.",
  },
];
export const unavailable: Record<
  string,
  { title: string; message: string; fields?: Field[] }
> = {
  users: {
    title: "User Insights",
    message:
      "Individual user management is not available in this portal yet. View championship participants and scores from Championship Analytics.",
  },
  gifts: {
    title: "Gifts",
    message: "Gift management is not available yet.",
    fields: [
      required("giftType", "Gift type"),
      required("description", "Description", "textarea"),
      required("imageUrl", "Image URL", "url"),
    ],
  },
  "teachers/new": {
    title: "New Teacher",
    message:
      "Teacher registration is not available yet. Existing teachers can be reviewed from Teachers.",
    fields: [
      required("name", "Teacher name"),
      required("username", "Username"),
      required("email", "Email", "email"),
      required("phone", "Phone"),
    ],
  },
  signup: {
    title: "Teacher Registration",
    message:
      "New teacher registration is not available yet. Contact your administrator to request an account.",
    fields: [
      required("name", "Name"),
      required("username", "Username"),
      required("email", "Email", "email"),
      required("phone", "Phone"),
      required("institute", "Institute"),
      required("department", "Department"),
    ],
  },
  "help/teacher": {
    title: "Teacher’s Help",
    message: "Help content is not available yet.",
  },
  "help/user": {
    title: "User Help",
    message: "Help content is not available yet.",
  },
  "privacy/teacher": {
    title: "Teacher Terms and Privacy",
    message: "Teacher terms and privacy content are not available yet.",
  },
  "privacy/user": {
    title: "User Terms and Privacy",
    message: "User terms and privacy content are not available yet.",
  },
  "advertisements/publish": {
    title: "Publish Advertisement",
    message:
      "Advertisement scheduling is not available yet. Create an advertisement to use the supported placements.",
    fields: [
      required("title", "Advertisement title"),
      required("championship", "Championship"),
      required("startDate", "Start date", "date"),
      required("endDate", "End date", "date"),
    ],
  },
  "configs/complexity": {
    title: "Complexity",
    message: "Complexity configuration is not available yet.",
    fields: [required("complexity", "Complexity", "number")],
  },
  "configs/grace": {
    title: "Grace Percentage",
    message: "Grace percentage configuration is not available yet.",
    fields: [
      {
        ...required("percentage", "Grace percentage", "number"),
        min: 0,
        max: 100,
      },
    ],
  },
  "configs/championship": {
    title: "Championship Configuration",
    message: "Championship scoring configuration is not available yet.",
    fields: [
      required("complexity", "Complexity", "number"),
      required("coinValue", "Coin value", "number"),
    ],
  },
  "account/password": {
    title: "Change Password",
    message:
      "Use password recovery to request a reset link. Changing a password while signed in is not available yet.",
  },
  "account/delete": {
    title: "Delete Account",
    message:
      "Teacher account deletion is not available yet. Contact your administrator.",
  },
};
